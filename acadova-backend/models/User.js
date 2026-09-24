const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  credits: { type: Number, default: 2, min: [0, 'Credits cannot be negative'] },
  skillsToTeach: [{ type: String }],
  skillsToLearn: [{ type: String }],
  rating: { type: Number, default: 5.0 },
  role: { type: String, enum: ['student', 'moderator', 'admin'], default: 'student' },
  emailVerified: { type: Boolean, default: false },
  emailVerifiedAt: { type: Date },
  emailVerificationTokenHash: { type: String, select: false },
  emailVerificationExpires: { type: Date, select: false },
  emailVerificationSentAt: { type: Date, select: false },
}, { timestamps: true });

UserSchema.index({ skillsToTeach: 1, rating: -1 });
UserSchema.index({ emailVerificationTokenHash: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', UserSchema);
