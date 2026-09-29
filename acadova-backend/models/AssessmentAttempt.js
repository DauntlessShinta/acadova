const mongoose = require('mongoose');

const AssessmentAttemptSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
  answers: { type: [Number], required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  passed: { type: Boolean, required: true },
  rewardIssued: { type: Boolean, required: true, default: false },
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });

AssessmentAttemptSchema.index({ student: 1, assessment: 1, submittedAt: -1 });
module.exports = mongoose.model('AssessmentAttempt', AssessmentAttemptSchema);
