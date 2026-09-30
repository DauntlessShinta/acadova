const mongoose = require('mongoose');

const CreditTransactionSchema = new mongoose.Schema({
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User',
    required() { return this.type === 'session_payment'; } },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User',
    required() { return ['session_payment', 'initial_grant', 'assessment_reward'].includes(this.type); } },
  amount: { type: Number, required: true, min: [1, 'Amount must be positive'],
    validate: { validator: Number.isSafeInteger, message: 'Amount must be a positive whole number' } },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session',
    required() { return this.type === 'session_payment'; } },
  assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment',
    required() { return this.type === 'assessment_reward'; } },
  result: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentAttempt',
    required() { return this.type === 'assessment_reward'; } },
  resource: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningResource' },
  module: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningModule' },
  unlock: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningUnlock',
    required() { return this.type === 'learning_unlock'; } },
  adjustmentTarget: { type: mongoose.Schema.Types.ObjectId, ref: 'User',
    required() { return this.type === 'admin_adjustment'; } },
  adjustmentActor: { type: mongoose.Schema.Types.ObjectId, ref: 'User',
    required() { return this.type === 'admin_adjustment'; } },
  adjustmentDirection: { type: String, enum: ['credit', 'debit'],
    required() { return this.type === 'admin_adjustment'; } },
  adjustmentReason: { type: String, trim: true, minlength: 10, maxlength: 500,
    required() { return this.type === 'admin_adjustment'; } },
  adjustmentReference: { type: String,
    required() { return this.type === 'admin_adjustment'; } },
  type: { type: String, enum: ['session_payment', 'initial_grant', 'assessment_reward', 'learning_unlock', 'admin_adjustment'], default: 'session_payment' },
}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });

CreditTransactionSchema.pre('validate', function validateActiveCreditEvent() {
  if (this.type === 'initial_grant' && (this.fromUser != null || this.session != null)) {
    this.invalidate('type', 'An opening grant cannot have a sender or Session');
  }
  if (this.type === 'assessment_reward' && (this.fromUser != null || this.session != null)) {
    this.invalidate('type', 'An assessment reward cannot have a sender or Session');
  }
  if (this.type === 'learning_unlock'
    && (!this.fromUser || this.toUser || this.session || this.assessment || this.result
      || Boolean(this.resource) === Boolean(this.module))) {
    this.invalidate('type', 'A learning unlock needs one content target, a sender, and no recipient');
  }
  if (this.type === 'admin_adjustment') {
    const target = String(this.adjustmentTarget);
    const validSides = this.adjustmentDirection === 'credit'
      ? !this.fromUser && String(this.toUser) === target
      : !this.toUser && String(this.fromUser) === target;
    if (!validSides || this.session || this.assessment || this.result || this.resource || this.module || this.unlock) {
      this.invalidate('type', 'An Admin adjustment requires exactly one target side and no activity reference');
    }
  }
});

// These replace the legacy unfiltered unique session index only after the
// separately approved production index rollout. No startup code drops indexes.
CreditTransactionSchema.index({ session: 1, type: 1 }, { name: 'uniq_session_payment_session', unique: true,
  partialFilterExpression: { type: 'session_payment', session: { $exists: true } } });
CreditTransactionSchema.index({ toUser: 1 }, { name: 'uniq_initial_grant_recipient', unique: true,
  partialFilterExpression: { type: 'initial_grant', toUser: { $exists: true } } });
// Roll out explicitly in production before enabling assessment rewards there.
CreditTransactionSchema.index({ toUser: 1, assessment: 1, type: 1 }, {
  name: 'uniq_assessment_reward_recipient_assessment', unique: true,
  partialFilterExpression: { type: 'assessment_reward', toUser: { $exists: true }, assessment: { $exists: true } },
});
CreditTransactionSchema.index({ fromUser: 1, resource: 1, type: 1 }, {
  name: 'uniq_learning_unlock_ledger_resource', unique: true,
  partialFilterExpression: { type: 'learning_unlock', resource: { $exists: true } },
});
CreditTransactionSchema.index({ fromUser: 1, module: 1, type: 1 }, {
  name: 'uniq_learning_unlock_ledger_module', unique: true,
  partialFilterExpression: { type: 'learning_unlock', module: { $exists: true } },
});
CreditTransactionSchema.index({ adjustmentReference: 1 }, {
  name: 'uniq_admin_adjustment_reference', unique: true,
  partialFilterExpression: { type: 'admin_adjustment', adjustmentReference: { $exists: true } },
});

// The application exposes no transaction edit/delete routes. Future credit
// routes exist. Rewards are written only by the graded Assessment workflow.
module.exports = mongoose.model('CreditTransaction', CreditTransactionSchema);
