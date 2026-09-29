const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  learner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true, trim: true },
  scheduledAt: { type: Date },
  proposedScheduledAt: { type: Date },
  rescheduleProposedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rescheduleProposedAt: { type: Date },
  rescheduleProposalId: { type: String },
  learnerCheckedInAt: { type: Date },
  tutorCheckedInAt: { type: Date },
  startedAt: { type: Date },
  awaitingValidationAt: { type: Date },
  learnerConfirmedAt: { type: Date },
  tutorConfirmedAt: { type: Date },
  noShowAt: { type: Date },
  noShowReportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  noShowAbsent: { type: String, enum: ['learner', 'tutor', 'both'] },
  disputedAt: { type: Date },
  disputedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  disputeReason: { type: String, trim: true, maxlength: 500 },
  resolvedAt: { type: Date },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolution: { type: String, enum: ['confirm_session', 'cancel_session'] },
  resolutionNote: { type: String, trim: true, maxlength: 500 },
  meetingMethod: { type: String, enum: ['online', 'in-person'] },
  meetingLink: { type: String, trim: true, maxlength: 500 },
  location: { type: String, trim: true, maxlength: 300 },
  requestMessage: { type: String, trim: true, maxlength: 500 },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'scheduled', 'in_progress', 'awaiting_validation', 'rejected', 'declined', 'completed', 'cancelled', 'no_show', 'disputed', 'resolved'],
    default: 'pending',
  },
  creditAmount: { type: Number, required: true, min: [1, 'Credit amount must be positive'] },
  completedAt: { type: Date },
  confirmedAt: { type: Date },
  creditsSettledAt: { type: Date },
}, { timestamps: true });

// Speeds up "my sessions" and subject-demand analytics queries.
SessionSchema.index({ learner: 1 });
SessionSchema.index({ tutor: 1 });
SessionSchema.index({ subject: 1 });

module.exports = mongoose.model('Session', SessionSchema);
