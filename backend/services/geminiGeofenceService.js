/**
 * ═══════════════════════════════════════════════════════════════════════
 *  Gemini AI Contextual Geofence Service
 *  ─────────────────────────────────────
 *  Provides AI-powered route compliance analysis using Google Gemini.
 *  Designed for the 10-second ESP32 telemetry loop – calls the LLM only
 *  when mathematically-detected anomalies warrant deeper spatial reasoning.
 *
 *  Fail-safe: if the API key is missing, the model errors out, or the
 *  network times out, this module returns a neutral "pass-through" result
 *  so the core Haversine geofencing continues unimpeded.
 * ═══════════════════════════════════════════════════════════════════════
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// ── Configuration ───────────────────────────────────────────────────────
const GEMINI_MODEL    = 'gemini-2.0-flash';
const API_TIMEOUT_MS  = 4000;                     // hard cap per call
const TRAIL_SIZE      = 5;                        // sliding window of GPS coords per vehicle
const CORRIDOR_BUFFER = 1.5;                      // multiplier on direct-line distance for transit corridor
const MIN_TICKS_BETWEEN_AI    = 6;                // ~60 s at 10-s intervals for periodic checks
const STATIONARY_THRESHOLD_M  = 3;                // metres – below this the vehicle is "stopped"
const STATIONARY_TICKS_ALERT  = 3;                // consecutive stationary ticks before AI is consulted
const BEARING_CHANGE_TRIGGER  = 25;               // degrees – significant course change

// ── In-memory state ─────────────────────────────────────────────────────
const vehicleTrails     = {};   // { vehicleKey: [ {lat, lng, ts} … ] }
const vehicleTickCount  = {};   // { vehicleKey: number }
const lastAiTick        = {};   // { vehicleKey: number }  – tick of last AI call
const stationaryCount   = {};   // { vehicleKey: number }  – consecutive stationary ticks

// ── Haversine (metres) ─────────────────────────────────────────────────
const haversineMetres = (lat1, lon1, lat2, lon2) => {
  const toRad = v => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ── Bearing between two points (degrees) ────────────────────────────────
const bearing = (lat1, lon1, lat2, lon2) => {
  const toRad = v => (v * Math.PI) / 180;
  const toDeg = v => (v * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

// ── Point-to-segment distance (metres) ──────────────────────────────────
//    Distance from point P to the great-circle segment Source→Destination
const pointToSegmentDistance = (pLat, pLng, sLat, sLng, dLat, dLng) => {
  // Approximate via projection for short distances (< 100 km)
  const segLen = haversineMetres(sLat, sLng, dLat, dLng);
  if (segLen === 0) return haversineMetres(pLat, pLng, sLat, sLng);

  const dSP = haversineMetres(sLat, sLng, pLat, pLng);
  const dDP = haversineMetres(dLat, dLng, pLat, pLng);

  // Use the triangle-height method
  const s = (segLen + dSP + dDP) / 2;   // semi-perimeter
  const area = Math.sqrt(Math.max(0, s * (s - segLen) * (s - dSP) * (s - dDP)));
  return (2 * area) / segLen;             // height = 2·Area / base
};

// ── Default neutral result (used when AI is not called or fails) ────────
const neutralResult = () => ({
  isCompliant: true,
  zoneStatus: 'IN_TRANSIT_COMPLIANT',
  violationDetected: false,
  violationType: 'NONE',
  confidence: 0,
  aiReasoning: 'AI evaluation not triggered – Haversine baseline active.'
});

// ── Update the in-memory GPS trail ──────────────────────────────────────
const updateTrail = (vehicleKey, lat, lng) => {
  if (!vehicleTrails[vehicleKey]) vehicleTrails[vehicleKey] = [];
  vehicleTrails[vehicleKey].push({ lat, lng, ts: Date.now() });
  if (vehicleTrails[vehicleKey].length > TRAIL_SIZE) {
    vehicleTrails[vehicleKey].shift();
  }

  // Tick counter
  vehicleTickCount[vehicleKey] = (vehicleTickCount[vehicleKey] || 0) + 1;
};

// ── Determine if the AI should be consulted this tick ───────────────────
const shouldCallAI = (vehicleKey, ctx) => {
  const {
    inSource, inDestination, hasLeftSource, loadWeight,
    currentLat, currentLng, sourceGeofence, destinationGeofence
  } = ctx;

  // Never call AI if vehicle is inside source/destination geofences
  if (inSource || inDestination) return { call: false, reason: 'inside_geofence' };

  // Only care about active transit (left source)
  if (!hasLeftSource) return { call: false, reason: 'not_in_transit' };

  const tick = vehicleTickCount[vehicleKey] || 0;
  const lastTick = lastAiTick[vehicleKey] || 0;

  // ── Check 1: Corridor deviation ────────────────────────────────────
  const directDist = haversineMetres(
    sourceGeofence.lat, sourceGeofence.lng,
    destinationGeofence.lat, destinationGeofence.lng
  );
  const corridorMax = directDist * CORRIDOR_BUFFER;
  const offTrackDist = pointToSegmentDistance(
    currentLat, currentLng,
    sourceGeofence.lat, sourceGeofence.lng,
    destinationGeofence.lat, destinationGeofence.lng
  );
  if (offTrackDist > corridorMax) {
    return { call: true, reason: 'corridor_deviation', offTrackDist };
  }

  // ── Check 2: Suspicious stationary stop with load ──────────────────
  const trail = vehicleTrails[vehicleKey] || [];
  if (trail.length >= 2) {
    const prev = trail[trail.length - 2];
    const curr = trail[trail.length - 1];
    const moved = haversineMetres(prev.lat, prev.lng, curr.lat, curr.lng);
    if (moved < STATIONARY_THRESHOLD_M && loadWeight > 0) {
      stationaryCount[vehicleKey] = (stationaryCount[vehicleKey] || 0) + 1;
      if (stationaryCount[vehicleKey] >= STATIONARY_TICKS_ALERT) {
        return { call: true, reason: 'suspicious_stop', stationaryTicks: stationaryCount[vehicleKey] };
      }
    } else {
      stationaryCount[vehicleKey] = 0;
    }
  }

  // ── Check 3: Significant bearing change ────────────────────────────
  if (trail.length >= 3) {
    const p0 = trail[trail.length - 3];
    const p1 = trail[trail.length - 2];
    const p2 = trail[trail.length - 1];
    const b1 = bearing(p0.lat, p0.lng, p1.lat, p1.lng);
    const b2 = bearing(p1.lat, p1.lng, p2.lat, p2.lng);
    let diff = Math.abs(b2 - b1);
    if (diff > 180) diff = 360 - diff;
    if (diff > BEARING_CHANGE_TRIGGER) {
      return { call: true, reason: 'bearing_change', bearingDelta: diff };
    }
  }

  // ── Check 4: Periodic checkpoint ───────────────────────────────────
  if (tick - lastTick >= MIN_TICKS_BETWEEN_AI) {
    return { call: true, reason: 'periodic_checkpoint' };
  }

  return { call: false, reason: 'within_normal_parameters' };
};

// ── Build the Gemini prompt ─────────────────────────────────────────────
const buildPrompt = (ctx, triggerInfo) => {
  const trail = vehicleTrails[ctx.vehicleKey] || [];
  const trailStr = trail.map((p, i) =>
    `  [${i + 1}] lat=${p.lat.toFixed(6)}, lng=${p.lng.toFixed(6)} @ ${new Date(p.ts).toISOString()}`
  ).join('\n');

  return `You are a real-time geospatial compliance engine for a vehicle-borne overload surveillance (VBoS) system.

CONTEXT:
- Vehicle: ${ctx.vehicleNumber}
- Current GPS: lat=${ctx.currentLat.toFixed(6)}, lng=${ctx.currentLng.toFixed(6)}
- Load weight: ${ctx.loadWeight} tons
- Source geofence: lat=${ctx.sourceGeofence.lat.toFixed(6)}, lng=${ctx.sourceGeofence.lng.toFixed(6)}, radius=${ctx.sourceGeofence.radius}m
- Destination geofence: lat=${ctx.destinationGeofence.lat.toFixed(6)}, lng=${ctx.destinationGeofence.lng.toFixed(6)}, radius=${ctx.destinationGeofence.radius}m
- Trip status: ${ctx.tripStatus}
- Trigger reason: ${triggerInfo.reason}
- Recent GPS trail (last ${trail.length} readings, newest last):
${trailStr || '  (no trail data)'}

TASK:
Analyze the vehicle's spatial behavior relative to the approved source-to-destination corridor.
Determine compliance status and detect violations such as:
1. ROUTE_DEVIATION – vehicle significantly deviating from the direct corridor.
2. SUSPICIOUS_STOP – vehicle stationary mid-transit while carrying a load (possible illegal dumping).
3. UNAPPROVED_ZONE – vehicle in an area clearly outside the approved transit path.

Respond with ONLY a JSON object matching this exact schema:
{
  "isCompliant": boolean,
  "zoneStatus": "IN_SOURCE" | "IN_TRANSIT_COMPLIANT" | "MINOR_DETOUR" | "UNAUTHORIZED_DEVIATION" | "IN_DESTINATION",
  "violationDetected": boolean,
  "violationType": "NONE" | "ROUTE_DEVIATION" | "SUSPICIOUS_STOP" | "UNAPPROVED_ZONE",
  "confidence": number (0.0 to 1.0),
  "aiReasoning": "Brief 1-sentence explanation of the spatial analysis"
}`;
};

// ── Call Gemini with timeout ────────────────────────────────────────────
const callGemini = async (prompt) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[GeminiGeofence] GEMINI_API_KEY not set – falling back to Haversine.');
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,       // deterministic spatial reasoning
      maxOutputTokens: 256
    }
  });

  // Race against timeout
  const aiPromise = model.generateContent(prompt);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Gemini API timeout')), API_TIMEOUT_MS)
  );

  const result = await Promise.race([aiPromise, timeoutPromise]);
  const text = result.response.text();
  return JSON.parse(text);
};

// ── Validate the AI response shape ──────────────────────────────────────
const VALID_ZONE_STATUSES   = ['IN_SOURCE', 'IN_TRANSIT_COMPLIANT', 'MINOR_DETOUR', 'UNAUTHORIZED_DEVIATION', 'IN_DESTINATION'];
const VALID_VIOLATION_TYPES = ['NONE', 'ROUTE_DEVIATION', 'SUSPICIOUS_STOP', 'UNAPPROVED_ZONE'];

const validateAiResponse = (res) => {
  if (!res || typeof res !== 'object') return false;
  if (typeof res.isCompliant !== 'boolean') return false;
  if (!VALID_ZONE_STATUSES.includes(res.zoneStatus)) return false;
  if (typeof res.violationDetected !== 'boolean') return false;
  if (!VALID_VIOLATION_TYPES.includes(res.violationType)) return false;
  if (typeof res.confidence !== 'number' || res.confidence < 0 || res.confidence > 1) return false;
  if (typeof res.aiReasoning !== 'string') return false;
  return true;
};

// ═══════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════════════

/**
 * Evaluate a vehicle's geospatial compliance using Gemini AI.
 *
 * @param {Object} telemetry
 * @param {string} telemetry.vehicleNumber
 * @param {number} telemetry.currentLat
 * @param {number} telemetry.currentLng
 * @param {Object} telemetry.sourceGeofence      - { lat, lng, radius }
 * @param {Object} telemetry.destinationGeofence  - { lat, lng, radius }
 * @param {number} telemetry.loadWeight           - cargo weight in tons
 * @param {string} telemetry.tripStatus           - 'active' | etc.
 * @param {boolean} telemetry.inSource
 * @param {boolean} telemetry.inDestination
 * @param {boolean} telemetry.hasLeftSource
 *
 * @returns {Promise<Object>} AI analysis result (or neutral fallback)
 */
const evaluateGeofence = async (telemetry) => {
  const vehicleKey = telemetry.vehicleNumber || telemetry.deviceId || 'unknown';
  const ctx = { ...telemetry, vehicleKey };

  // Always update the GPS trail
  updateTrail(vehicleKey, ctx.currentLat, ctx.currentLng);

  // Decide whether to invoke AI
  const triggerInfo = shouldCallAI(vehicleKey, ctx);

  if (!triggerInfo.call) {
    return neutralResult();
  }

  // Attempt AI evaluation
  try {
    const prompt = buildPrompt(ctx, triggerInfo);
    const aiResult = await callGemini(prompt);

    if (aiResult && validateAiResponse(aiResult)) {
      lastAiTick[vehicleKey] = vehicleTickCount[vehicleKey] || 0;

      // Reset stationary counter if AI was consulted for that reason
      if (triggerInfo.reason === 'suspicious_stop') {
        stationaryCount[vehicleKey] = 0;
      }

      console.log(`[GeminiGeofence] Vehicle ${vehicleKey} | ${aiResult.zoneStatus} | ` +
                  `violation=${aiResult.violationDetected} | confidence=${aiResult.confidence} | ` +
                  `reason: ${aiResult.aiReasoning}`);

      return aiResult;
    }

    // Invalid response shape – fall back
    console.warn(`[GeminiGeofence] Invalid AI response shape for ${vehicleKey}, using fallback.`);
    return neutralResult();

  } catch (err) {
    console.error(`[GeminiGeofence] API error for ${vehicleKey}: ${err.message} – using Haversine fallback.`);
    return neutralResult();
  }
};

/**
 * Reset all in-memory state for a vehicle (call when a trip closes).
 */
const resetVehicleState = (vehicleKey) => {
  delete vehicleTrails[vehicleKey];
  delete vehicleTickCount[vehicleKey];
  delete lastAiTick[vehicleKey];
  delete stationaryCount[vehicleKey];
};

module.exports = {
  evaluateGeofence,
  resetVehicleState,
  // Exported for unit testing
  _internals: {
    haversineMetres,
    bearing,
    pointToSegmentDistance,
    shouldCallAI,
    buildPrompt,
    validateAiResponse,
    neutralResult,
    vehicleTrails,
    vehicleTickCount
  }
};
