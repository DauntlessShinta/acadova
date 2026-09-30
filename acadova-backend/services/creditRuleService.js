const CreditConfig = require('../models/CreditConfig');
const { startingCredits, sessionCreditCost, assessmentReward } = require('../config/creditRules');

const defaults = Object.freeze({ startingCreditGrant: startingCredits,
  tutoringSessionCost: sessionCreditCost, assessmentReward });
const RULE_ID = 'credit_rules';

const getEffectiveCreditRules = async (session) => {
  let query = CreditConfig.findById(RULE_ID);
  if (session) query = query.session(session);
  const configured = await query.lean();
  if (!configured) return { ...defaults, version: 0 };
  if (![configured.startingCreditGrant, configured.tutoringSessionCost, configured.assessmentReward]
    .every((value) => Number.isSafeInteger(value) && value >= 1 && value <= 1000)
    || !Number.isSafeInteger(configured.version) || configured.version < 1) {
    throw new Error('Invalid stored credit configuration');
  }
  return {
    startingCreditGrant: configured.startingCreditGrant,
    tutoringSessionCost: configured.tutoringSessionCost,
    assessmentReward: configured.assessmentReward,
    version: configured.version,
  };
};

module.exports = { defaults, RULE_ID, getEffectiveCreditRules };
