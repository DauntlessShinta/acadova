const mongoose = require('mongoose');
const { YEAR_LEVELS, LANGUAGES } = require('../utils/profileDetails');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  currentTermId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicTerm', default: null },
  academicGuard: { type: Number, default: 0, select: false },
  studyNudgesEnabled: { type: Boolean, default: true },
  // Absent historical preferences are private. Never include in public User DTOs.
  growthVisibility: { type: new mongoose.Schema({ showLevel: Boolean, showRank: Boolean,
    badgeIds: { type: [String], validate: value => value.length <= 5 } }, { _id: false }), select: false },
  studyNudgeDismissals: { type: [String], default: [], select: false, validate: value => value.length <= 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  // Absent on legacy accounts. Rotate atomically with recovery/identity changes.
  authVersion: { type: String, select: false, match: /^[a-f0-9]{64}$/ },
  // Missing on historical accounts behaves as zero; never returned by profile APIs.
  failedLoginAttempts: { type: Number, default: 0, select: false, min: 0 },
  lastFailedLoginAt: { type: Date, select: false },
  loginCooldownUntil: { type: Date, select: false },
  credits: { type: Number, default: 0, min: [0, 'Credits cannot be negative'],
    validate: { validator: Number.isSafeInteger, message: 'Credits must be a whole number' } },
  // Atomic, per-account reward claim. Historical users without this field match $ne.
  rewardedAssessments: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Assessment' }],
    select: false, default: [] },
  weeklyAvailability: { type: new mongoose.Schema({ timezone: String, ranges: [{ day: Number, start: String, end: String, _id: false }] }, { _id: false }), default: undefined },
  skillsToTeach: [{ type: String }],
  skillsToLearn: [{ type: String }],
  // Optional, owner-managed details. Missing visibility never grants public access.
  bio: { type: String, trim: true, maxlength: 1000 },
  university: { type: String, trim: true, maxlength: 120 },
  yearLevel: { type: String, enum: YEAR_LEVELS },
  languages: { type: [{ type: String, enum: LANGUAGES }], default: undefined,
    validate: value => !value || (value.length <= 10 && new Set(value).size === value.length) },
  profileVisibility: { type: new mongoose.Schema({ bio: Boolean, university: Boolean, yearLevel: Boolean, languages: Boolean }, { _id: false }), default: undefined },
  rating: { type: Number, default: 5.0 },
  role: { type: String, enum: ['student', 'moderator', 'admin'], default: 'student' },
  emailVerified: { type: Boolean, default: false },
  // Missing on historical accounts means active. Checked against the database on every protected request.
  suspendedAt: { type: Date, default: null },
  suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  suspensionReason: { type: String, maxlength: 500 },
  // Explicitly set only by new registrations; historical accounts are never backfilled.
  openingGrantFrozenAt: {type:Date,select:false},
  openingGrantEligible: { type: Boolean, default: false, select: false },
  // Registration-time snapshot; older eligible registrations without it retain the original 100.
  openingGrantAmount: { type: Number, select: false, min: 1, max: 1000 },
  emailVerifiedAt: { type: Date },
  emailVerificationTokenHash: { type: String, select: false },
  emailVerificationExpires: { type: Date, select: false },
  emailVerificationSentAt: { type: Date, select: false },
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  googleSub: { type: String, select: false },
  policyAcceptedAt: { type: Date },
  policyVersion: { type: String },
  // Set when introductory setup is completed or intentionally skipped.
  onboardingFinishedAt: { type: Date },
}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });

UserSchema.index({ skillsToTeach: 1, rating: -1 });
UserSchema.index({ emailVerificationTokenHash: 1 }, { unique: true, sparse: true });
UserSchema.index({ googleSub: 1 }, { name: 'uniq_user_google_sub', unique: true, sparse: true });

UserSchema.pre('save',function(){if(require('../config/studentExperience').active() && this.isModified('credits') && (!this.isNew || this.credits!==0)) require('../config/studentExperience').rejectCreditWrite();});
for(const op of ['updateOne','updateMany','findOneAndUpdate','replaceOne','findOneAndReplace']) UserSchema.pre(op,function(){if(!require('../config/studentExperience').active())return;const update=this.getUpdate();if(Array.isArray(update) || Object.entries(update?.$rename||{}).some(([from,to])=>[from,to].some(path=>path==='credits'||path.startsWith('credits.'))) || Object.entries(update || {}).some(([key,value])=>key==='credits'||key.startsWith('credits.')||key.startsWith('$')&&Object.keys(value || {}).some(path=>path==='credits'||path.startsWith('credits.')))) require('../config/studentExperience').rejectCreditWrite();});
UserSchema.pre('insertMany',function(docs){if(require('../config/studentExperience').active() && docs.some(d=>d.credits!=null&&d.credits!==0)) require('../config/studentExperience').rejectCreditWrite();});
for(const op of ['replaceOne','findOneAndReplace']) UserSchema.pre(op,function(){require('../config/studentExperience').rejectCreditWrite();});
UserSchema.pre('bulkWrite',function(){require('../config/studentExperience').rejectCreditWrite();});
module.exports = mongoose.model('User', UserSchema);
