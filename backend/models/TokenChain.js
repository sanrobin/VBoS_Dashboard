const mongoose = require('mongoose');

const tokenChainSchema = new mongoose.Schema({
  tokenId: { type: String, required: true },
  tokenHash: { type: String, required: true },
  prevTokenHash: { type: String, required: true },
  vehicleNumber: { type: String, required: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
  action: { type: String, enum: ['OPENED', 'CLOSED'], required: true },
  timestamp: { type: Date, default: Date.now },
  payload: { type: mongoose.Schema.Types.Mixed },   // lat, lng, weight at event time
}, { timestamps: true });

tokenChainSchema.index({ vehicleNumber: 1, createdAt: -1 });

module.exports = mongoose.model('TokenChain', tokenChainSchema);
