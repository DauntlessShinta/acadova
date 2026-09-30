const mongoose = require('mongoose');

const CreditRuleChangeSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  before: { type: mongoose.Schema.Types.Mixed, required: true },
  after: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' });

module.exports = mongoose.model('CreditRuleChange', CreditRuleChangeSchema);
