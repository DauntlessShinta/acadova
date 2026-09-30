const mongoose = require('mongoose');

const SessionMessageSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true, trim: true, maxlength: 1000 },
  // Explicit flag keeps historical pre-P5 messages out of new unread/reminder scans.
  unreadForRecipient: { type: Boolean, default: true },
  readAt: { type: Date, default: null },
}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });

SessionMessageSchema.index({ session: 1, createdAt: 1 });
SessionMessageSchema.index({ session: 1, sender: 1, unreadForRecipient: 1, createdAt: 1 });
SessionMessageSchema.index({ unreadForRecipient: 1, createdAt: 1 });

module.exports = mongoose.model('SessionMessage', SessionMessageSchema);
