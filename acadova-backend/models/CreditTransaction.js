const mongoose = require('mongoose');

const CreditTransactionSchema = new mongoose.Schema({
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: [1, 'Amount must be positive'] },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  type: { type: String, enum: ['session_payment'], default: 'session_payment' },
}, { timestamps: true });

// A session can settle only once. This database constraint backs up the
// confirmation controller's idempotency checks during concurrent requests.
CreditTransactionSchema.index({ session: 1 }, { unique: true });

// This collection is an append-only audit log; credits are never written to
// directly by clients, only created by learner confirmation.
module.exports = mongoose.model('CreditTransaction', CreditTransactionSchema);
