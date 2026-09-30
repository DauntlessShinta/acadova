const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  actorRole: { type: String, enum: ['moderator', 'admin'], required: true, immutable: true },
  action: { type: String, required: true, immutable: true },
  targetType: { type: String, required: true, immutable: true },
  targetId: { type: String, required: true, immutable: true },
  summary: { type: String, required: true, maxlength: 200, immutable: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
  createdAt: { type: Date, default: Date.now, immutable: true },
}, { strict: 'throw', versionKey: false, autoIndex: process.env.NODE_ENV !== 'production' });

AuditLogSchema.index({ createdAt: -1, _id: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ actor: 1, createdAt: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
