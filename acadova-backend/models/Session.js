const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  learner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true, trim: true },
  scheduledAt: { type: Date },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'],
    default: 'pending',
  },
  creditAmount: { type: Number, required: true, min: [1, 'Credit amount must be positive'] },
  completedAt: { type: Date },
}, { timestamps: true });

// Speeds up "my sessions" and subject-demand analytics queries.
SessionSchema.index({ learner: 1 });
SessionSchema.index({ tutor: 1 });
SessionSchema.index({ subject: 1 });

module.exports = mongoose.model('Session', SessionSchema);
