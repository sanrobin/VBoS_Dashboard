const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  tokenId: { type: String, required: true, unique: true },
  deviceId: { type: String, required: true },
  vehicleNumber: { type: String, required: true },
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
  overload: { type: Boolean, default: false },
  deviceStatus: { type: String, default: 'unknown' },
  status: { type: String, enum: ['active', 'completed', 'violated'], default: 'active' },
  allowed: { type: Boolean, default: true },
  finalLatitude: Number,
  finalLongitude: Number
}, { timestamps: true });

module.exports = mongoose.model('Trip', tripSchema);
