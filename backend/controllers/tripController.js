const Trip = require('../models/Trip');
const DailyTripCount = require('../models/DailyTripCount');
const TokenChain = require('../models/TokenChain');
const { getRealtimeStats, getISTDateString, DAILY_LIMIT, routeDistanceKm } = require('../services/realtimeService');

// ── GET /api/trips ──────────────────────────────────────────────────────
const getTrips = async (req, res) => {
  try {
    const trips = await Trip.find().sort({ createdAt: -1 }).limit(100);
    res.json(trips);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load trip history', error: error.message });
  }
};

// ── GET /api/trips/history?date=YYYY-MM-DD ─────────────────────────────
const getTripsByDate = async (req, res) => {
  try {
    const dateStr = req.query.date || getISTDateString();
    // Build start/end of day in IST (UTC+5:30)
    const dayStart = new Date(`${dateStr}T00:00:00+05:30`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999+05:30`);

    const trips = await Trip.find({
      startTime: { $gte: dayStart, $lte: dayEnd }
    }).sort({ tripNumber: 1 });

    res.json(trips);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load trips by date', error: error.message });
  }
};

// ── GET /api/trips/tokens?page=1&limit=20 ───────────────────────────────
const getTokenHistory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [tokens, total] = await Promise.all([
      TokenChain.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      TokenChain.countDocuments()
    ]);

    res.json({ tokens, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load token history', error: error.message });
  }
};

// ── GET /api/trips/daily-summary ────────────────────────────────────────
const getDailySummary = async (req, res) => {
  try {
    const dateStr = req.query.date || getISTDateString();
    const dailyCount = await DailyTripCount.findOne({ date: dateStr });

    res.json({
      date: dateStr,
      tripCount: dailyCount?.tripCount || 0,
      dailyLimit: dailyCount?.dailyLimit || DAILY_LIMIT,
      routeDistanceKm: dailyCount?.routeDistanceKm || routeDistanceKm,
      remaining: (dailyCount?.dailyLimit || DAILY_LIMIT) - (dailyCount?.tripCount || 0)
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load daily summary', error: error.message });
  }
};

// ── GET /api/dashboard ──────────────────────────────────────────────────
const getDashboardMetrics = async () => {
  const todayStr = getISTDateString();
  const dayStart = new Date(`${todayStr}T00:00:00+05:30`);
  const dayEnd = new Date(`${todayStr}T23:59:59.999+05:30`);

  const [completedToday, totalCompleted, dbViolations, dbOverloads, dailyCount] = await Promise.all([
    Trip.countDocuments({ startTime: { $gte: dayStart, $lte: dayEnd } }),
    Trip.countDocuments(),
    Trip.countDocuments({ violated: true, startTime: { $gte: dayStart, $lte: dayEnd } }),
    Trip.countDocuments({ overload: true, startTime: { $gte: dayStart, $lte: dayEnd } }),
    DailyTripCount.findOne({ date: todayStr })
  ]);

  const { activeTrips, latestVehicle } = getRealtimeStats();

  let activeOverloads = 0;
  activeTrips.forEach((trip) => {
    if (trip.overload) activeOverloads++;
  });

  const vehicleOverloadAlert = (latestVehicle && latestVehicle.overload) ? 1 : 0;
  const tripCountToday = dailyCount?.tripCount || completedToday;
  const limit = dailyCount?.dailyLimit || DAILY_LIMIT;

  return {
    totalTrips: totalCompleted,
    tripCountToday,
    activeTrips: Math.max(0, limit - tripCountToday),   // remaining trips
    dailyLimit: limit,
    violations: dbViolations,
    overloadAlerts: dbOverloads + activeOverloads + (activeTrips.length === 0 ? vehicleOverloadAlert : 0),
    routeDistanceKm: dailyCount?.routeDistanceKm || routeDistanceKm,
    currentToken: activeTrips.length > 0 ? activeTrips[0].tokenId : null
  };
};

const getLatestVehicle = (req, res) => {
  try {
    const { latestVehicle } = require('../services/realtimeService');
    return res.json(latestVehicle || {});
  } catch (error) {
    return res.status(500).json({ message: 'Unable to fetch vehicle snapshot', error: error.message });
  }
};

module.exports = {
  getTrips,
  getTripsByDate,
  getTokenHistory,
  getDailySummary,
  getDashboardMetrics,
  getLatestVehicle
};
