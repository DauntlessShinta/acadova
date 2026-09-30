const mongoose = require('mongoose');
const CreditConfig = require('../models/CreditConfig');
const CreditRuleChange = require('../models/CreditRuleChange');
const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');
const { RULE_ID, getEffectiveCreditRules } = require('../services/creditRuleService');
const { logSecurityEvent } = require('../utils/securityLogger');

const publicRules = ({ startingCreditGrant, tutoringSessionCost, assessmentReward, version }) =>
  ({ startingCreditGrant, tutoringSessionCost, assessmentReward, version });

const hasAdjustmentIndex = (index) => index.name === 'uniq_admin_adjustment_reference'
  && index.unique === true && index.key?.adjustmentReference === 1
  && index.partialFilterExpression?.type === 'admin_adjustment'
  && index.partialFilterExpression?.adjustmentReference?.$exists === true;

const adjustmentResponse = (transaction, balance, repeated = false) => ({
  success: true, repeated, data: {
    id: String(transaction._id), reference: transaction.adjustmentReference,
    targetStudentId: String(transaction.adjustmentTarget), direction: transaction.adjustmentDirection,
    amount: transaction.amount, reason: transaction.adjustmentReason,
    balance, createdAt: transaction.createdAt,
  },
});

exports.getCreditRules = async (req, res) => {
  try { return res.json({ success: true, data: await getEffectiveCreditRules() }); }
  catch { return res.status(503).json({ success: false, message: 'Credit rules are unavailable.' }); }
};

exports.updateCreditRules = async (req, res) => {
  let dbSession;
  try {
    dbSession = await mongoose.startSession();
    let changed;
    await dbSession.withTransaction(async () => {
      const before = await getEffectiveCreditRules(dbSession);
      if (before.version !== req.body.expectedVersion) {
        throw Object.assign(new Error('Credit rules changed. Reload and try again.'), { status: 409 });
      }
      const values = publicRules(req.body);
      delete values.version;
      let after;
      if (before.version === 0) {
        [after] = await CreditConfig.create([{ _id: RULE_ID, ...values, version: 1,
          updatedBy: req.user.id }], { session: dbSession });
      } else {
        after = await CreditConfig.findOneAndUpdate({ _id: RULE_ID, version: before.version },
          { $set: { ...values, updatedBy: req.user.id }, $inc: { version: 1 } },
          { new: true, session: dbSession, runValidators: true });
        if (!after) throw Object.assign(new Error('Credit rules changed. Reload and try again.'), { status: 409 });
      }
      changed = publicRules(after);
      await CreditRuleChange.create([{ actor: req.user.id, before, after: changed }], { session: dbSession });
    });
    logSecurityEvent('admin.credit_rules_changed', req, { beforeVersion: req.body.expectedVersion,
      afterVersion: changed.version });
    return res.json({ success: true, data: changed });
  } catch (error) {
    return res.status(error.status || ([11000, 112].includes(error.code) ? 409 : 503)).json({ success: false,
      message: error.status === 409 || [11000, 112].includes(error.code)
        ? 'Credit rules changed. Reload and try again.' : 'Credit rules could not be updated.' });
  } finally { if (dbSession) await dbSession.endSession(); }
};

exports.adjustCredits = async (req, res) => {
  const { targetStudentId, direction, amount, reason, reference } = req.body;
  let dbSession;
  const sameRequest = (tx) => String(tx.adjustmentTarget) === targetStudentId
    && tx.adjustmentDirection === direction && tx.amount === amount
    && tx.adjustmentReason === reason && String(tx.adjustmentActor) === req.user.id;
  const existingResponse = async () => {
    const existing = await CreditTransaction.findOne({ type: 'admin_adjustment', adjustmentReference: reference }).lean();
    if (!existing) return null;
    if (!sameRequest(existing)) return res.status(409).json({ success: false,
      message: 'This adjustment reference belongs to a different request.' });
    const student = await User.findOne({ _id: targetStudentId, role: 'student' }).select('credits').lean();
    return res.json(adjustmentResponse(existing, student?.credits ?? null, true));
  };
  try {
    // Production is fail-closed until the separately managed unique index exists.
    if (process.env.NODE_ENV === 'production') {
      const indexes = await CreditTransaction.collection.indexes();
      if (!indexes.some(hasAdjustmentIndex)) return res.status(503).json({ success: false,
        message: 'Credit adjustments are temporarily unavailable.' });
    }
    const repeated = await existingResponse();
    if (repeated) return repeated;
    dbSession = await mongoose.startSession();
    let entry;
    let balance;
    await dbSession.withTransaction(async () => {
      const target = await User.findOne({ _id: targetStudentId, role: 'student' })
        .select('credits').session(dbSession).lean();
      if (!target) throw Object.assign(new Error('Student not found.'), { status: 404 });
      if (direction === 'debit' && target.credits < amount) {
        throw Object.assign(new Error('Debit would make the balance negative.'), { status: 409 });
      }
      const delta = direction === 'credit' ? amount : -amount;
      const updated = await User.findOneAndUpdate({ _id: targetStudentId, role: 'student',
        ...(direction === 'debit' ? { credits: { $gte: amount } }
          : { credits: { $lte: Number.MAX_SAFE_INTEGER - amount } }) },
      { $inc: { credits: delta } }, { session: dbSession, new: true });
      if (!updated) throw Object.assign(new Error('Balance changed. Reload and try again.'), { status: 409 });
      balance = updated.credits;
      [entry] = await CreditTransaction.create([{
        type: 'admin_adjustment', amount, adjustmentTarget: targetStudentId,
        adjustmentActor: req.user.id, adjustmentDirection: direction,
        adjustmentReason: reason, adjustmentReference: reference,
        ...(direction === 'credit' ? { toUser: targetStudentId } : { fromUser: targetStudentId }),
      }], { session: dbSession });
    });
    logSecurityEvent('admin.credit_adjustment', req, { targetId: targetStudentId, direction,
      amount, reference });
    return res.status(201).json(adjustmentResponse(entry, balance));
  } catch (error) {
    if (error.code === 11000 || error.code === 112) {
      try { const repeated = await existingResponse(); if (repeated) return repeated; } catch { /* Fail closed. */ }
    }
    return res.status(error.status || 503).json({ success: false,
      message: error.status ? error.message : 'Credit adjustment could not be completed.' });
  } finally { if (dbSession) await dbSession.endSession(); }
};

exports.getRecentCreditActivity = async (req, res) => {
  try {
    const rows = await CreditTransaction.find({ type: { $in: [
      'initial_grant', 'session_payment', 'assessment_reward', 'learning_unlock', 'admin_adjustment',
    ] } }).select('type amount fromUser toUser adjustmentTarget adjustmentActor adjustmentDirection adjustmentReason adjustmentReference session assessment resource module createdAt')
      .sort({ createdAt: -1, _id: -1 }).limit(50).lean();
    return res.json({ success: true, data: rows });
  } catch { return res.status(503).json({ success: false, message: 'Credit activity unavailable.' }); }
};
