const getFirebaseDatabase = require('../config/firebase');
const crypto = require('crypto');
const Trip = require('../models/Trip');
const DailyTripCount = require('../models/DailyTripCount');
const TokenChain = require('../models/TokenChain');

// ── Geofence Configuration (5 m radius for prototype) ──────────────────
const SOURCE_GEOFENCE = { latitude: 9.904190, longitude: 78.034401, radiusMeters: 5 };
const DESTINATION_GEOFENCE = { latitude: 9.904404, longitude: 78.034454, radiusMeters: 5 };

const OVERLOAD_THRESHOLD_TONS = 35;
const MAX_LOAD_READINGS = 10;

// ── In-memory state ────────────────────────────────────────────────────
const state = {
  latestVehicle: null,
  activeTrips: []       // one entry per device while a trip is in progress
};

// ── Haversine distance (metres) ────────────────────────────────────────
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const insideGeofence = (latitude, longitude, fence) => {
  return calculateDistance(latitude, longitude, fence.latitude, fence.longitude) <= fence.radiusMeters;
};

// ── Route distance & daily-limit lookup ────────────────────────────────
const routeDistanceKm = calculateDistance(
  SOURCE_GEOFENCE.latitude, SOURCE_GEOFENCE.longitude,
  DESTINATION_GEOFENCE.latitude, DESTINATION_GEOFENCE.longitude
) / 1000;

const computeDailyLimit = (distKm) => {
  if (distKm <= 10) return 15;   // 0–10 km  → 12–18, midpoint 15
  if (distKm <= 30) return 8;    // 10–30 km → 6–10,  midpoint 8
  if (distKm <= 80) return 4;    // 30–80 km → 3–6,   midpoint 4
  return 2;                      // 100+ km  → 1–3,   midpoint 2
};

const DAILY_LIMIT = computeDailyLimit(routeDistanceKm);

// ── IST date helper (UTC+5:30) ─────────────────────────────────────────
const getISTDateString = (d = new Date()) => {
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
};

// ── SHA-256 token generation ────────────────────────────────────────────
const generateTokenId = () => `VBOS-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

const hashToken = (tokenId, prevHash, timestamp, vehicleNumber) => {
  const payload = `${tokenId}|${prevHash}|${timestamp}|${vehicleNumber}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
};

// ── DailyTripCount helpers ──────────────────────────────────────────────
const getOrCreateDailyCount = async (vehicleNumber) => {
  const dateStr = getISTDateString();
  let doc = await DailyTripCount.findOne({ vehicleNumber, date: dateStr });
  if (!doc) {
    doc = await DailyTripCount.create({
      vehicleNumber,
      date: dateStr,
      tripCount: 0,
      dailyLimit: DAILY_LIMIT,
      routeDistanceKm,
      lastTokenHash: 'GENESIS'
    });
  }
  return doc;
};

// ── Token chain persistence ─────────────────────────────────────────────
const recordTokenEvent = async (action, tokenId, tokenHash, prevTokenHash, vehicleNumber, tripId, payload) => {
  try {
    await TokenChain.create({ tokenId, tokenHash, prevTokenHash, vehicleNumber, tripId, action, payload });
  } catch (err) {
    console.error(`Failed to record token ${action}:`, err.message);
  }
};

// ── Save completed trip to MongoDB ──────────────────────────────────────
const createTripRecord = async (tripData) => {
  try {
    const trip = new Trip(tripData);
    await trip.save();
    return trip;
  } catch (error) {
    console.error('Failed to save completed trip:', error.message);
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════
//  CORE: Process each Firebase vehicle update
// ═══════════════════════════════════════════════════════════════════════
const processVehicleUpdate = async (deviceId, snapshot) => {
  if (!snapshot) return;

  // ── Parse incoming fields ──────────────────────────────────────────
  const latitude = Number(snapshot.latitude || snapshot.lat || 0);
  const longitude = Number(snapshot.longitude || snapshot.lng || snapshot.Long || 0);
  const loadWeight = Number(snapshot.weight || snapshot.loadWeight || snapshot.Weight || 0);
  const vehicleNumber = snapshot.vehicleNumber || snapshot.vehicle || snapshot.vehicle_no || 'UNKNOWN';
  const deviceStatus = snapshot.status || snapshot.deviceStatus || snapshot.device_status || 'unknown';
  const timestamp = (snapshot.timestamp || snapshot.time) ? new Date(snapshot.timestamp || snapshot.time) : new Date();

  const activeTrip = state.activeTrips.find((t) => t.deviceId === deviceId);
  const inSource = insideGeofence(latitude, longitude, SOURCE_GEOFENCE);
  const inDestination = insideGeofence(latitude, longitude, DESTINATION_GEOFENCE);
  const overload = loadWeight > OVERLOAD_THRESHOLD_TONS;

  // ── Always update latest vehicle snapshot ──────────────────────────
  state.latestVehicle = {
    deviceId,
    latitude,
    longitude,
    loadWeight,
    vehicleNumber,
    deviceStatus,
    timestamp,
    overload,
    inSource,
    inDestination,
    routeDistanceKm,
    dailyLimit: DAILY_LIMIT
  };

  if (activeTrip) {
    state.latestVehicle.tokenId = activeTrip.tokenId;
    state.latestVehicle.activeTripTokenId = activeTrip.tokenId;
    state.latestVehicle.activeTripStatus = activeTrip.status;
    state.latestVehicle.loadReadings = activeTrip.loadReadings;
    state.latestVehicle.finalLoad = activeTrip.finalLoad;
    state.latestVehicle.path = activeTrip.path;
  }

  // ── 1. Vehicle is inside SOURCE and no active trip → prepare trip ──
  if (!activeTrip && inSource) {
    const dailyCount = await getOrCreateDailyCount(vehicleNumber);
    const prevHash = dailyCount.lastTokenHash || 'GENESIS';
    const tokenId = generateTokenId();
    const tokenHash = hashToken(tokenId, prevHash, timestamp.toISOString(), vehicleNumber);

    // Check if daily limit is already exceeded
    const limitExceeded = dailyCount.tripCount >= dailyCount.dailyLimit;

    const newTrip = {
      tokenId,
      tokenHash,
      prevTokenHash: prevHash,
      deviceId,
      vehicleNumber,
      source: { latitude, longitude, enteredAt: timestamp },
      startTime: timestamp,
      loadWeight,
      loadReadings: [loadWeight],
      finalLoad: null,
      overload,
      deviceStatus,
      status: 'active',
      tripNumber: dailyCount.tripCount + 1,
      dailyTripLimit: dailyCount.dailyLimit,
      routeDistanceKm,
      violated: limitExceeded,
      violationType: limitExceeded ? ['limit_exceeded'] : [],
      finalLatitude: latitude,
      finalLongitude: longitude,
      path: [[latitude, longitude]],
      hasLeftSource: false
    };
    state.activeTrips.push(newTrip);

    // Record token OPENED event
    await recordTokenEvent('OPENED', tokenId, tokenHash, prevHash, vehicleNumber, null, {
      lat: latitude, lng: longitude, weight: loadWeight
    });

    // Update daily count chain link
    dailyCount.lastTokenHash = tokenHash;
    await dailyCount.save();

    // Expose to frontend
    state.latestVehicle.tokenId = tokenId;
    state.latestVehicle.activeTripTokenId = tokenId;
    state.latestVehicle.activeTripStatus = 'active';
    state.latestVehicle.loadReadings = newTrip.loadReadings;
    state.latestVehicle.path = newTrip.path;
    state.latestVehicle.tripNumber = newTrip.tripNumber;
    state.latestVehicle.tripCountToday = dailyCount.tripCount;
    state.latestVehicle.dailyLimit = dailyCount.dailyLimit;
    return;
  }

  // ── 2. Active trip in progress → update it ────────────────────────
  if (activeTrip) {
    activeTrip.finalLatitude = latitude;
    activeTrip.finalLongitude = longitude;
    activeTrip.loadWeight = loadWeight;
    activeTrip.overload = overload || activeTrip.overload;
    activeTrip.deviceStatus = deviceStatus;

    // Append to load readings (up to MAX_LOAD_READINGS)
    if (activeTrip.loadReadings.length < MAX_LOAD_READINGS) {
      activeTrip.loadReadings.push(loadWeight);
      if (activeTrip.loadReadings.length === MAX_LOAD_READINGS) {
        activeTrip.finalLoad = loadWeight;                    // 10th reading is final
        activeTrip.overload = loadWeight > OVERLOAD_THRESHOLD_TONS || activeTrip.overload;
      }
    }

    // Update GPS path (skip duplicates)
    const lastPos = activeTrip.path[activeTrip.path.length - 1];
    if (lastPos[0] !== latitude || lastPos[1] !== longitude) {
      activeTrip.path.push([latitude, longitude]);
    }

    // Expose to frontend
    state.latestVehicle.loadReadings = activeTrip.loadReadings;
    state.latestVehicle.finalLoad = activeTrip.finalLoad;
    state.latestVehicle.path = activeTrip.path;
    state.latestVehicle.tokenId = activeTrip.tokenId;
    state.latestVehicle.tripNumber = activeTrip.tripNumber;

    // Mark that the vehicle has LEFT the source geofence (trip officially starts)
    if (!inSource) {
      activeTrip.hasLeftSource = true;
    }

    // ── 3. Vehicle reached DESTINATION after leaving source → close trip ──
    if (inDestination && activeTrip.hasLeftSource) {
      activeTrip.destination = { latitude, longitude, arrivedAt: timestamp };
      activeTrip.endTime = timestamp;
      activeTrip.durationMinutes = Math.round((timestamp - activeTrip.startTime) / 60000);

      // Determine violations
      const violations = [...(activeTrip.violationType || [])];
      const isOverloaded = activeTrip.overload;
      if (isOverloaded && !violations.includes('overload')) {
        violations.push('overload');
      }

      activeTrip.violationType = violations;
      activeTrip.violated = violations.length > 0;
      activeTrip.status = activeTrip.violated ? 'violated' : 'completed';
      activeTrip.allowed = !activeTrip.violated;

      // Persist trip
      const savedTrip = await createTripRecord(activeTrip);

      // Record token CLOSED event
      const closeHash = hashToken(activeTrip.tokenId, activeTrip.tokenHash, timestamp.toISOString(), activeTrip.vehicleNumber);
      await recordTokenEvent('CLOSED', activeTrip.tokenId, closeHash, activeTrip.tokenHash, activeTrip.vehicleNumber,
        savedTrip ? savedTrip._id : null,
        { lat: latitude, lng: longitude, weight: activeTrip.finalLoad || activeTrip.loadWeight }
      );

      // Increment daily trip count
      try {
        const dailyCount = await getOrCreateDailyCount(activeTrip.vehicleNumber);
        dailyCount.tripCount += 1;
        dailyCount.lastTokenHash = closeHash;
        await dailyCount.save();
      } catch (err) {
        console.error('Failed to increment daily trip count:', err.message);
      }

      // Remove from active trips
      state.activeTrips = state.activeTrips.filter((t) => t.deviceId !== deviceId);
      return;
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════
//  Firebase listener
// ═══════════════════════════════════════════════════════════════════════
const processFirebaseSnapshot = async (snapshot) => {
  const data = snapshot.val();
  if (!data) return;

  // If the data has nested device keys, iterate; otherwise treat as single device
  if (typeof data === 'object' && !data.lat && !data.latitude) {
    const updatePromises = Object.entries(data).map(([deviceId, payload]) =>
      processVehicleUpdate(deviceId, payload)
    );
    await Promise.all(updatePromises);
  } else {
    // Single device: use vehicle_no or 'default' as deviceId
    await processVehicleUpdate(data.vehicle_no || 'default', data);
  }
};

const startFirebaseListener = () => {
  try {
    const database = getFirebaseDatabase();
    const vehiclePath = process.env.FIREBASE_VEHICLE_PATH || '/vehicles';
    const ref = database.ref(vehiclePath);

    ref.on('value', async (snapshot) => {
      await processFirebaseSnapshot(snapshot);
    });

    console.log(`Listening for ESP32 updates on Firebase path ${vehiclePath}`);
    console.log(`Route distance: ${routeDistanceKm.toFixed(3)} km → daily limit: ${DAILY_LIMIT} trips`);
  } catch (error) {
    console.error('Firebase listener setup error:', error.message);
  }
};

// ═══════════════════════════════════════════════════════════════════════
//  Exported helpers for controllers
// ═══════════════════════════════════════════════════════════════════════
const getRealtimeStats = () => ({
  latestVehicle: state.latestVehicle,
  activeTrips: state.activeTrips
});

const getLatestVehicle = () => {
  if (!state.latestVehicle) return null;

  const activeTrip = state.activeTrips.find((t) => t.deviceId === state.latestVehicle.deviceId);
  const lastSeen = new Date(state.latestVehicle.timestamp);
  const now = new Date();

  const baseVehicle = {
    ...state.latestVehicle,
    tokenId: state.latestVehicle.tokenId || activeTrip?.tokenId || null,
    activeTripTokenId: state.latestVehicle.activeTripTokenId || activeTrip?.tokenId || null,
    activeTripStatus: state.latestVehicle.activeTripStatus || activeTrip?.status || null,
    loadReadings: activeTrip?.loadReadings || state.latestVehicle.loadReadings || [],
    finalLoad: activeTrip?.finalLoad || state.latestVehicle.finalLoad || null,
    tripNumber: activeTrip?.tripNumber || state.latestVehicle.tripNumber || null
  };

  // Update status to OFFLINE if older than 2 minutes
  if (now - lastSeen > 120000) {
    return { ...baseVehicle, deviceStatus: 'OFFLINE' };
  }
  return baseVehicle;
};

const getActiveTripCount = () => state.activeTrips.length;

module.exports = {
  startFirebaseListener,
  getLatestVehicle,
  getRealtimeStats,
  getActiveTripCount,
  getISTDateString,
  DAILY_LIMIT,
  routeDistanceKm
};
