const getFirebaseDatabase = require('../config/firebase');
const crypto = require('crypto');
const Trip = require('../models/Trip');

const SOURCE_GEOFENCE = { latitude: 9.904190, longitude: 78.034401, radiusMeters: 10 };
const DESTINATION_GEOFENCE = { latitude: 9.904404, longitude: 78.034454, radiusMeters: 10 };

const state = {
  latestVehicle: null,
  activeTrips: []
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const insideGeofence = (latitude, longitude, fence) => {
  const distance = calculateDistance(latitude, longitude, fence.latitude, fence.longitude);
  return distance <= fence.radiusMeters;
};

const generateTokenId = () => {
  return `VBOS-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
};

const createTripRecord = async (tripData) => {
  try {
    const trip = new Trip(tripData);
    await trip.save();
  } catch (error) {
    console.error('Failed to save completed trip:', error.message);
  }
};

const processVehicleUpdate = async (deviceId, snapshot) => {
  if (!snapshot) return;

  const latitude = Number(snapshot.latitude || snapshot.lat || 0);
  const longitude = Number(snapshot.longitude || snapshot.lng || snapshot.Long || 0);
  const loadWeight = Number(snapshot.weight || snapshot.loadWeight || snapshot.Weight || 0);
  const vehicleNumber = snapshot.vehicleNumber || snapshot.vehicle || snapshot.vehicle_no || 'UNKNOWN';
  const deviceStatus = snapshot.status || snapshot.deviceStatus || snapshot.device_status || 'unknown';
  const timestamp = (snapshot.timestamp || snapshot.time) ? new Date(snapshot.timestamp || snapshot.time) : new Date();

  const activeTrip = state.activeTrips.find((trip) => trip.deviceId === deviceId);
  const inSource = insideGeofence(latitude, longitude, SOURCE_GEOFENCE);
  const inDestination = insideGeofence(latitude, longitude, DESTINATION_GEOFENCE);
  const overload = loadWeight > 10;

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
    inDestination
  };

  if (activeTrip) {
    state.latestVehicle.tokenId = activeTrip.tokenId;
    state.latestVehicle.activeTripTokenId = activeTrip.tokenId;
    state.latestVehicle.activeTripStatus = activeTrip.status;
  }

  if (!activeTrip && inSource) {
    const newTrip = {
      tokenId: generateTokenId(),
      deviceId,
      vehicleNumber,
      source: { latitude, longitude, enteredAt: timestamp },
      startTime: timestamp,
      loadWeight,
      overload,
      deviceStatus,
      status: 'active',
      finalLatitude: latitude,
      finalLongitude: longitude,
      path: [[latitude, longitude]],
      hasLeftSource: false
    };
    state.activeTrips.push(newTrip);
    
    // Add path to latestVehicle so frontend can draw it
    state.latestVehicle.path = newTrip.path;
    state.latestVehicle.tokenId = newTrip.tokenId;
    return;
  }

  if (activeTrip) {
    activeTrip.finalLatitude = latitude;
    activeTrip.finalLongitude = longitude;
    activeTrip.loadWeight = loadWeight;
    activeTrip.overload = overload || activeTrip.overload;
    activeTrip.deviceStatus = deviceStatus;
    
    // Update path if moved slightly to prevent massive arrays of the same position
    const lastPos = activeTrip.path[activeTrip.path.length - 1];
    if (lastPos[0] !== latitude || lastPos[1] !== longitude) {
      activeTrip.path.push([latitude, longitude]);
    }
    
    state.latestVehicle.path = activeTrip.path;
    state.latestVehicle.tokenId = activeTrip.tokenId;

    if (!inSource) {
      activeTrip.hasLeftSource = true;
    }

    if (inDestination && activeTrip.hasLeftSource) {
      activeTrip.destination = { latitude, longitude, arrivedAt: timestamp };
      activeTrip.endTime = timestamp;
      activeTrip.durationMinutes = Math.round((timestamp - activeTrip.startTime) / 60000);
      activeTrip.status = overload ? 'violated' : 'completed';
      activeTrip.allowed = !overload;
      await createTripRecord(activeTrip);
      state.activeTrips = state.activeTrips.filter((trip) => trip.deviceId !== deviceId);
      return;
    }
  }
};

const processFirebaseSnapshot = async (snapshot) => {
  const data = snapshot.val();
  if (!data) {
    return;
  }

  const updatePromises = Object.entries(data).map(([deviceId, payload]) => processVehicleUpdate(deviceId, payload));
  await Promise.all(updatePromises);
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
  } catch (error) {
    console.error('Firebase listener setup error:', error.message);
  }
};

const getRealtimeStats = () => {
  return {
    latestVehicle: state.latestVehicle,
    activeTrips: state.activeTrips
  };
};

const getLatestVehicle = () => {
  if (!state.latestVehicle) return null;
  const activeTrip = state.activeTrips.find((trip) => trip.deviceId === state.latestVehicle.deviceId);
  const lastSeen = new Date(state.latestVehicle.timestamp);
  const now = new Date();
  const baseVehicle = {
    ...state.latestVehicle,
    tokenId: state.latestVehicle.tokenId || activeTrip?.tokenId || null,
    activeTripTokenId: state.latestVehicle.activeTripTokenId || activeTrip?.tokenId || null,
    activeTripStatus: state.latestVehicle.activeTripStatus || activeTrip?.status || null
  };
  
  // Update status to OFFLINE if older than 2 minutes
  if (now - lastSeen > 120000) {
    return { ...baseVehicle, deviceStatus: 'OFFLINE' };
  }
  return baseVehicle;
};

module.exports = {
  startFirebaseListener,
  getLatestVehicle,
  getRealtimeStats
};
