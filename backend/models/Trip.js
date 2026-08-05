const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  tokenId: { type: String, required: true, unique: true },
  tokenHash: { type: String },
  prevTokenHash: { type: String, default: 'GENESIS' },
  deviceId: { type: String, required: true },
  vehicleNumber: { type: String, required: true },
  tripNumber: { type: Number },
  dailyTripLimit: { type: Number },
  routeDistanceKm: { type: Number },
  source: {
    latitude: Number,
    longitude: Number,
    enteredAt: Date
  },
  destination: {
    latitude: Number,
    longitude: Number,
    arrivedAt: Date
  },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  durationMinutes: { type: Number },
  loadWeight: { type: Number, required: true },
  loadReadings: [{ type: Number }],
  finalLoad: { type: Number },
  overload: { type: Boolean, default: false },
  deviceStatus: { type: String, default: 'unknown' },
  status: { type: String, enum: ['active', 'completed', 'violated'], default: 'active' },
  allowed: { type: Boolean, default: true },
  violated: { type: Boolean, default: false },
  violationType: [{ type: String, enum: ['overload', 'limit_exceeded'] }],
  finalLatitude: Number,
  finalLongitude: Number,
  path: { type: [[Number]], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Trip', tripSchema);
