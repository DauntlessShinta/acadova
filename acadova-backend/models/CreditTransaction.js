const mongoose = require('mongoose');

const CreditTransactionSchema = new mongoose.Schema({
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User',
    required() { return this.type === 'session_payment'; } },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User',
    required() { return ['session_payment', 'initial_grant'].includes(this.type); } },
  amount: { type: Number, required: true, min: [1, 'Amount must be positive'],
    validate: { validator: Number.isSafeInteger, message: 'Amount must be a positive whole number' } },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session',
    required() { return this.type === 'session_payment'; } },
  type: { type: String, enum: ['session_payment', 'initial_grant', 'assessment_reward', 'learning_unlock', 'admin_adjustment'], default: 'session_payment' },
}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });

CreditTransactionSchema.pre('validate', function validateActiveCreditEvent() {
  if (this.type === 'initial_grant' && (this.fromUser != null || this.session != null)) {
    this.invalidate('type', 'An opening grant cannot have a sender or Session');
  }
});

// These replace the legacy unfiltered unique session index only after the
// separately approved production index rollout. No startup code drops indexes.
CreditTransactionSchema.index({ session: 1, type: 1 }, { name: 'uniq_session_payment_session', unique: true,
  partialFilterExpression: { type: 'session_payment', session: { $exists: true } } });
CreditTransactionSchema.index({ toUser: 1 }, { name: 'uniq_initial_grant_recipient', unique: true,
  partialFilterExpression: { type: 'initial_grant', toUser: { $exists: true } } });

// The application exposes no transaction edit/delete routes. Future credit
// events are schema vocabulary only; P3.2 writes Session payments and grants.
module.exports = mongoose.model('CreditTransaction', CreditTransactionSchema);
