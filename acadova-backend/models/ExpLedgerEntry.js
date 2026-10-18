const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  eventKey: { type: String, required: true, maxlength: 160, immutable: true },
  kind: { type: String, enum: ['official_assessment', 'verified_tutoring', 'reversal'], required: true, immutable: true },
  delta: { type: Number, required: true, immutable: true, validate: {
    validator(value) { return Number.isSafeInteger(value) && (this.kind === 'reversal' ? value < 0 : value > 0) && Math.abs(value) <= 1000; },
    message: 'EXP requires a bounded, signed whole amount matching its event kind.',
  } },
  sourceId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  // Optional for compatibility with the inactive foundation's synthetic rows.
  award: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpAward', immutable: true },
  reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpLedgerEntry', immutable: true,
    required() { return this.kind === 'reversal'; } },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', immutable: true,
    required() { return this.kind === 'reversal'; } },
  reason: { type: String, required: true, minlength: 10, maxlength: 500, immutable: true },
  policyVersion: { type: String, required: true, immutable: true },
  createdAt: { type: Date, default: Date.now, immutable: true },
}, { autoIndex: false, autoCreate: false, versionKey: false, strict: 'throw' });
schema.index({ owner: 1, eventKey: 1 }, { unique: true, name: 'uniq_exp_owner_event' });
schema.index({ reversalOf: 1 }, { unique: true, name: 'uniq_exp_reversal', partialFilterExpression: { reversalOf: { $exists: true } } });
schema.index({ owner: 1, createdAt: -1 }, { name: 'exp_private_history' });
schema.pre('save', function () { if (!this.isNew) throw new Error('EXP entries are append-only. Record a reversal instead.'); });
for (const method of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete']) {
  schema.pre(method, function () { throw new Error('EXP entries are append-only.'); });
}
// Mongoose document deletion and bulk operations do not use the query hooks above.
// Keep these paths closed too; awards must be individual validated inserts.
schema.pre('deleteOne', { document: true, query: false }, function () {
  throw new Error('EXP entries are append-only.');
});
schema.pre('bulkWrite', function () { throw new Error('EXP entries are append-only.'); });
module.exports = mongoose.model('ExpLedgerEntry', schema);
