const mongoose = require('mongoose');
const LearningTopic = require('../models/LearningTopic');
const LearningResource = require('../models/LearningResource');
const LearningModule = require('../models/LearningModule');
const LearningUnlock = require('../models/LearningUnlock');
const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');

const targetConfig = {
  resource: { model: LearningResource, statusField: 'reviewStatus' },
  module: { model: LearningModule, statusField: 'status' },
};
const hasIndex = (indexes, name, fields, predicate) => indexes.some((index) => index.name === name
  && index.unique === true && fields.every((field) => index.key?.[field] === 1)
  && Object.keys(index.key || {}).length === fields.length
  && Object.keys(index.partialFilterExpression || {}).length === Object.keys(predicate).length
  && Object.entries(predicate).every(([key, value]) => value === true
    ? index.partialFilterExpression?.[key]?.$exists === true
      && Object.keys(index.partialFilterExpression[key]).length === 1
    : index.partialFilterExpression?.[key] === value));

const indexesReady = async () => {
  if (process.env.NODE_ENV !== 'production') return true;
  const [entitlementIndexes, ledgerIndexes] = await Promise.all([
    LearningUnlock.collection.indexes(), CreditTransaction.collection.indexes(),
  ]);
  return hasIndex(entitlementIndexes, 'uniq_learning_unlock_student_resource',
    ['student', 'resource'], { resource: true })
    && hasIndex(entitlementIndexes, 'uniq_learning_unlock_student_module',
      ['student', 'module'], { module: true })
    && hasIndex(ledgerIndexes, 'uniq_learning_unlock_ledger_resource',
      ['fromUser', 'resource', 'type'], { type: 'learning_unlock', resource: true })
    && hasIndex(ledgerIndexes, 'uniq_learning_unlock_ledger_module',
      ['fromUser', 'module', 'type'], { type: 'learning_unlock', module: true });
};

const isRetryable = (error) => error.code === 11000 || error.code === 112
  || error.hasErrorLabel?.('TransientTransactionError');
const balanceNow = async (studentId) => {
  const user = await User.findById(studentId).select('credits').lean();
  return user?.credits ?? null;
};

const unlock = (kind) => async (req, res) => {
  const { model, statusField } = targetConfig[kind];
  const target = req.params.id;
  const owner = req.user.id;
  const entitlementFilter = { student: owner, [kind]: target };
  try {
    // Published state and topic are required even for someone who paid before archival.
    const content = await model.findOne({ _id: target, [statusField]: 'published' }).lean();
    if (!content || !await LearningTopic.exists({ _id: content.topic, status: 'published' })) {
      return res.status(404).json({ success: false, message: 'Learning content not available.' });
    }
    if (content.creditCost === 0) {
      return res.json({ success: true, data: { unlocked: true, alreadyAccessible: true,
        balance: req.user.credits } });
    }
    if (!Number.isSafeInteger(content.creditCost) || content.creditCost < 1 || content.creditCost > 1000) {
      return res.status(409).json({ success: false, message: 'This content has an invalid price.' });
    }
    if (await LearningUnlock.exists(entitlementFilter)) {
      return res.json({ success: true, data: { unlocked: true, alreadyUnlocked: true,
        balance: await balanceNow(owner) } });
    }
    if (!await indexesReady()) {
      return res.status(503).json({ success: false, message: 'Learning unlocks are temporarily unavailable.' });
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let dbSession;
      try {
        dbSession = await mongoose.startSession();
        let response;
        await dbSession.withTransaction(async () => {
          const current = await model.findOne({ _id: target, [statusField]: 'published' })
            .session(dbSession).lean();
          if (!current || !await LearningTopic.exists({ _id: current.topic, status: 'published' })) {
            const error = new Error('Learning content not available.'); error.status = 404; throw error;
          }
          if (current.creditCost === 0) {
            response = { unlocked: true, alreadyAccessible: true, balance: await balanceNow(owner) };
            return;
          }
          if (!Number.isSafeInteger(current.creditCost) || current.creditCost < 1
            || current.creditCost > 1000) {
            const error = new Error('This content has an invalid price.'); error.status = 409; throw error;
          }
          const owned = await LearningUnlock.findOne(entitlementFilter).session(dbSession).lean();
          if (owned) {
            response = { unlocked: true, alreadyUnlocked: true,
              balance: await balanceNow(owner) };
            return;
          }
          const charged = await User.findOneAndUpdate(
            { _id: owner, role: 'student', credits: { $gte: current.creditCost } },
            { $inc: { credits: -current.creditCost } }, { new: true, session: dbSession },
          );
          if (!charged) {
            const error = new Error('Not enough credits to unlock this content.');
            error.status = 409; throw error;
          }
          const [entitlement] = await LearningUnlock.create([{
            student: owner, [kind]: current._id, pricePaid: current.creditCost,
          }], { session: dbSession });
          await CreditTransaction.create([{
            type: 'learning_unlock', fromUser: owner, amount: current.creditCost,
            [kind]: current._id, unlock: entitlement._id,
          }], { session: dbSession });
          response = { unlocked: true, alreadyUnlocked: false, balance: charged.credits,
            amountSpent: current.creditCost };
        });
        return res.json({ success: true, data: response });
      } catch (error) {
        if (error.status === 404) return res.status(404).json({ success: false, message: error.message });
        // A racing request may have committed the same durable entitlement.
        if (await LearningUnlock.exists(entitlementFilter)) {
          return res.json({ success: true, data: { unlocked: true, alreadyUnlocked: true,
            balance: await balanceNow(owner) } });
        }
        if (error.status === 409) return res.status(409).json({ success: false, message: error.message });
        if (!isRetryable(error) || attempt === 1) throw error;
      } finally {
        if (dbSession) await dbSession.endSession();
      }
    }
  } catch {
    return res.status(500).json({ success: false, message: 'Learning unlock could not be completed.' });
  }
};

exports.unlockResource = unlock('resource');
exports.unlockModule = unlock('module');
