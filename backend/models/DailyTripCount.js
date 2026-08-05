const mongoose = require('mongoose');

const dailyTripCountSchema = new mongoose.Schema({
  vehicleNumber: { type: String, required: true },
  date: { type: String, required: true },            // 'YYYY-MM-DD' IST
  tripCount: { type: Number, default: 0 },
  dailyLimit: { type: Number, default: 12 },
  routeDistanceKm: { type: Number },
  lastTokenHash: { type: String, default: 'GENESIS' },
}, { timestamps: true });

dailyTripCountSchema.index({ vehicleNumber: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyTripCount', dailyTripCountSchema);
