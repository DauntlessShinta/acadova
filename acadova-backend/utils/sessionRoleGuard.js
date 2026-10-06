const Session = require('../models/Session');
const CreditTransaction = require('../models/CreditTransaction');
const { classifyLegacySession } = require('./sessionLifecycleCompatibility');

const participantFilter = (userId) => ({ $or: [{ learner: userId }, { tutor: userId }] });

// No-show remains disputable. Legacy completed records need ledger evidence.
function inFlightParticipantFilter(userId) {
  return { $and: [
    participantFilter(userId),
    { status: { $in: ['pending', 'accepted', 'scheduled', 'in_progress',
      'awaiting_validation', 'no_show', 'disputed'] } },
  ] };
}

async function hasInFlightSessions(userId, dbSession) {
  if (await Session.exists(inFlightParticipantFilter(userId)).session(dbSession)) return true;
  const legacy = await Session.find({ $and: [participantFilter(userId),
    { status: 'completed', confirmedAt: null }] })
    .select('_id learner tutor status creditAmount confirmedAt creditsSettledAt')
    .session(dbSession).lean();
  if (!legacy.length) return false;
  const payments = await CreditTransaction.find({ session: { $in: legacy.map((row) => row._id) } })
    .select('session fromUser toUser amount type').session(dbSession).lean();
  return legacy.some((row) => classifyLegacySession(row,
    payments.filter((payment) => String(payment.session) === String(row._id)))
    .settlementState !== 'settled');
}
module.exports = { inFlightParticipantFilter, hasInFlightSessions };
