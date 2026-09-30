const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  // Missing on historical accounts behaves as zero; never returned by profile APIs.
  failedLoginAttempts: { type: Number, default: 0, select: false, min: 0 },
  lastFailedLoginAt: { type: Date, select: false },
  loginCooldownUntil: { type: Date, select: false },
  credits: { type: Number, default: 0, min: [0, 'Credits cannot be negative'],
    validate: { validator: Number.isSafeInteger, message: 'Credits must be a whole number' } },
  // Atomic, per-account reward claim. Historical users without this field match $ne.
  rewardedAssessments: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Assessment' }],
    select: false, default: [] },
  skillsToTeach: [{ type: String }],
  skillsToLearn: [{ type: String }],
  rating: { type: Number, default: 5.0 },
  role: { type: String, enum: ['student', 'moderator', 'admin'], default: 'student' },
  emailVerified: { type: Boolean, default: false },
  // Missing on historical accounts means active. Checked against the database on every protected request.
  suspendedAt: { type: Date, default: null },
  suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  suspensionReason: { type: String, maxlength: 500 },
  // Explicitly set only by new registrations; historical accounts are never backfilled.
  openingGrantEligible: { type: Boolean, default: false, select: false },
  // Registration-time snapshot; older eligible registrations without it retain the original 100.
  openingGrantAmount: { type: Number, select: false, min: 1, max: 1000 },
  emailVerifiedAt: { type: Date },
  emailVerificationTokenHash: { type: String, select: false },
  emailVerificationExpires: { type: Date, select: false },
  emailVerificationSentAt: { type: Date, select: false },
}, { timestamps: true });

UserSchema.index({ skillsToTeach: 1, rating: -1 });
UserSchema.index({ emailVerificationTokenHash: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', UserSchema);
