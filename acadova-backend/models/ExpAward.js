const mongoose = require('mongoose');
// Mutable claim/projection; finalized amounts live only in the append-only ledger.
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  eventKey: { type: String, required: true, immutable: true, maxlength: 160 },
  kind: { type: String, enum: ['official_assessment', 'verified_tutoring'], required: true, immutable: true },
  sourceId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  assessment: { type: mongoose.Schema.Types.ObjectId, immutable: true },
  learner: { type: mongoose.Schema.Types.ObjectId, immutable: true },
  pairKey: { type: String, immutable: true, maxlength: 50 },
  amount: { type: Number, required: true, immutable: true, min: 1, max: 1000, validate: Number.isSafeInteger },
  status: { type: String, enum: ['pending', 'held', 'finalized', 'reversed'], required: true },
  occurredAt: { type: Date, required: true, immutable: true }, readyAt: { type: Date, immutable: true },
  finalizedAt: Date, reversedAt: Date, holdReason: { type: String, maxlength: 500 },
  holdActor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  policy: { type: new mongoose.Schema({
    version: String, assessmentAmount: Number, tutoringAmount: Number, minimumMinutes: Number,
    reportWindowHours: Number, dailyAwards: Number, weeklyAwards: Number, tutoringDaily: Number,
    tutoringWeekly: Number, pairDaily: Number, pairWeekly: Number,
  }, { _id: false, strict: 'throw' }), required: true, immutable: true },
  createdAt: { type: Date, required: true, immutable: true },
}, { autoIndex: false, autoCreate: false, strict: 'throw', versionKey: false });
schema.index({ owner: 1, eventKey: 1 }, { unique: true, name: 'uniq_exp_claim_owner_event' });
schema.index({ owner: 1, createdAt: -1 });
schema.index({ pairKey: 1, createdAt: -1 });
schema.index({ status: 1, readyAt: 1 });
module.exports = mongoose.model('ExpAward', schema);
