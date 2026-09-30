const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');

const NotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  title: { type: String, required: true, maxlength: 100 },
  message: { type: String, required: true, maxlength: 240 },
  relatedType: { type: String, enum: ['Session', 'LearningResource', 'LearningModule', 'Rating', 'User'], required: true },
  relatedId: { type: mongoose.Schema.Types.ObjectId, required: true },
  eventKey: { type: String, required: true, maxlength: 180 },
  readAt: { type: Date, default: null },
  pushStatus: { type: String, enum: ['pending', 'sending', 'accepted', 'unavailable', 'skipped', 'failed'], default: 'pending' },
  pushAttempts: { type: Number, default: 0 },
  pushAttemptedAt: Date,
  pushAcceptedAt: Date,
  pushIdempotencyKey: { type: String, default: randomUUID },
}, { timestamps: { createdAt: true, updatedAt: false }, autoIndex: process.env.NODE_ENV !== 'production' });

NotificationSchema.index({ eventKey: 1 }, { unique: true, name: 'uniq_notification_event_key' });
NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ pushStatus: 1, pushAttemptedAt: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
