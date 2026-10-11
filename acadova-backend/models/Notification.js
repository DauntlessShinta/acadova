const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');

const NotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  title: { type: String, required: true, maxlength: 100 },
  message: { type: String, required: true, maxlength: 240 },
  relatedType: { type: String, enum: ['Session', 'LearningResource', 'LearningModule', 'Rating', 'User', 'StudySet'], required: true },
  relatedId: { type: mongoose.Schema.Types.ObjectId, required: true },
  eventKey: { type: String, required: true, maxlength: 180 },
  actionTarget: { type: String, enum: ['completion', 'staff_review'] },
  proposal: { type: new mongoose.Schema({
    proposalId: { type: String, required: true, match: /^[a-f0-9-]{36}$/i },
    proposedScheduledAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    displayTimezone: { type: String, enum: ['UTC'], required: true },
  }, { _id: false }) },
  emailStatus: { type: String, enum: ['none', 'pending', 'sending', 'accepted', 'failed', 'exhausted'], default: 'none' },
  emailAttempts: { type: Number, default: 0 },
  emailAttemptedAt: Date,
  emailNextAttemptAt: Date,
  emailAcceptedAt: Date,
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
// Performance only. Correctness uses the existing unique eventKey and atomic claims.
NotificationSchema.index({ emailStatus: 1, emailNextAttemptAt: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
