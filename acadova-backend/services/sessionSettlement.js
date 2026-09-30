const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');

// Call only after a conditional Session claim, inside the same MongoDB transaction.
const transferSessionCredits = async (session, dbSession) => {
  if (!Number.isSafeInteger(session.creditAmount) || session.creditAmount < 1
    || String(session.learner) === String(session.tutor)) {
    throw Object.assign(new Error('This session has invalid credit evidence.'), { status: 400 });
  }
  const learner = await User.findOneAndUpdate(
    { _id: session.learner, role: 'student', credits: { $gte: session.creditAmount } },
    { $inc: { credits: -session.creditAmount } },
    { session: dbSession, new: true },
  );
  if (!learner) {
    throw Object.assign(new Error('You do not have enough credits to confirm this session.'), { status: 400 });
  }
  const tutor = await User.findOneAndUpdate(
    { _id: session.tutor, role: 'student',
      credits: { $lte: Number.MAX_SAFE_INTEGER - session.creditAmount } },
    { $inc: { credits: session.creditAmount } },
    { session: dbSession, new: true }
  );
  if (!tutor) throw Object.assign(new Error('Tutor account is unavailable.'), { status: 400 });

  await CreditTransaction.create([{
    fromUser: session.learner,
    toUser: session.tutor,
    amount: session.creditAmount,
    session: session._id,
  }], { session: dbSession });
};

module.exports = { transferSessionCredits };
