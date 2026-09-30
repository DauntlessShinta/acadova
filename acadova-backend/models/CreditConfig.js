const mongoose = require('mongoose');

const rule = { type: Number, required: true, min: 1, max: 1000,
  validate: { validator: Number.isSafeInteger, message: 'Credit rule must be a whole number' } };

const CreditConfigSchema = new mongoose.Schema({
  _id: { type: String, default: 'credit_rules', enum: ['credit_rules'] },
  startingCreditGrant: rule,
  tutoringSessionCost: rule,
  assessmentReward: rule,
  version: { type: Number, required: true, min: 1 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });

module.exports = mongoose.model('CreditConfig', CreditConfigSchema);
