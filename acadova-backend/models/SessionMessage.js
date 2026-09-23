const mongoose = require('mongoose');

const SessionMessageSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true, trim: true, maxlength: 1000 },
}, { timestamps: true });

SessionMessageSchema.index({ session: 1, createdAt: 1 });

module.exports = mongoose.model('SessionMessage', SessionMessageSchema);
