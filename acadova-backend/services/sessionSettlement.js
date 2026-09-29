const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');

// Call only after a conditional Session claim, inside the same MongoDB transaction.
const transferSessionCredits = async (session, dbSession) => {
  const learner = await User.findById(session.learner).session(dbSession);
  if (!learner || learner.credits < session.creditAmount) {
    throw Object.assign(new Error('You do not have enough credits to confirm this session.'), { status: 400 });
  }
  const tutor = await User.findOneAndUpdate(
    { _id: session.tutor, role: 'student' },
    { $inc: { credits: session.creditAmount } },
    { session: dbSession, new: true }
  );
  if (!tutor) throw Object.assign(new Error('Tutor account is unavailable.'), { status: 400 });

  learner.credits -= session.creditAmount;
  await learner.save({ session: dbSession });

  await CreditTransaction.create([{
    fromUser: session.learner,
    toUser: session.tutor,
    amount: session.creditAmount,
    session: session._id,
  }], { session: dbSession });
};

module.exports = { transferSessionCredits };
