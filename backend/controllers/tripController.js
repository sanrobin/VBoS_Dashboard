const Trip = require('../models/Trip');
const { getRealtimeStats } = require('../services/realtimeService');

const getTrips = async (req, res) => {
  try {
    const trips = await Trip.find().sort({ createdAt: -1 }).limit(100);
    res.json(trips);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load trip history', error: error.message });
  }
};

const getDashboardMetrics = async () => {
  const completedTrips = await Trip.countDocuments();
  const dbOverloads = await Trip.countDocuments({ overload: true });
  const dbViolations = await Trip.countDocuments({ allowed: false });
  const { activeTrips, latestVehicle } = getRealtimeStats();

  let activeOverloads = 0;
  activeTrips.forEach(trip => {
    if (trip.overload) activeOverloads++;
  });
  
  // If the user's current vehicle is overloaded, we can count it as an alert even without an active trip
  const vehicleOverloadAlert = (latestVehicle && latestVehicle.overload) ? 1 : 0;

  return {
    totalTrips: completedTrips + activeTrips.length,
    activeTrips: activeTrips.length,
    violations: dbViolations,
    overloadAlerts: dbOverloads + activeOverloads + (activeTrips.length === 0 ? vehicleOverloadAlert : 0)
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
  getDashboardMetrics,
  getLatestVehicle
};
