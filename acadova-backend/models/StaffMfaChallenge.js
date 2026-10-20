const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  handleHash: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fingerprint: { type: String, required: true, select: false },
  verifier: { type: String, required: true, select: false },
  attempts: { type: Number, default: 0, required: true },
  state: { type: String, enum: ['sending', 'ready', 'consumed', 'invalid'], required: true },
  createdAt: { type: Date, required: true },
  sentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
}, { strict: 'throw', versionKey: false, autoIndex: process.env.NODE_ENV !== 'production' });
schema.index({ handleHash: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('StaffMfaChallenge', schema);
