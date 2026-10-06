const mongoose = require('mongoose');
const User = require('../models/User');
const Session = require('../models/Session');
const CreditTransaction = require('../models/CreditTransaction');
const { classifyLegacySession } = require('../utils/sessionLifecycleCompatibility');

const normalizeSubject = (value) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const activeStatuses = ['pending', 'accepted', 'scheduled', 'in_progress',
  'awaiting_validation', 'no_show', 'disputed'];

// Called after both User records have been written in the creation transaction.
async function rejectDuplicateRequest(learner, tutor, subject, scheduledAt, dbSession) {
  const candidates = await Session.find({ learner, tutor,
    $or: [{ scheduledAt }, { proposedScheduledAt: scheduledAt }],
    status: { $in: [...activeStatuses, 'completed'] } }).session(dbSession).lean();
  for (const row of candidates) {
    if (normalizeSubject(row.subject) !== normalizeSubject(subject)) continue;
    if (row.status === 'completed') {
      const payments = await CreditTransaction.find({ session: row._id }).session(dbSession).lean();
      if (classifyLegacySession(row, payments).settlementState === 'settled') continue;
    }
    throw Object.assign(new Error('You already have this session request pending.'), { status: 409 });
  }
}

// Pending alternatives are not commitments. No end time/duration is inferred.
async function commitSchedule(session, instant, write) {
  const dbSession = await mongoose.startSession();
  try {
    let updated;
    await dbSession.withTransaction(async () => {
      const participants = [session.learner, session.tutor].map(String).sort();
      for (const participant of participants) {
        const locked = await User.findOneAndUpdate({ _id: participant },
          { $currentDate: { updatedAt: true } },
          { session: dbSession, timestamps: false, new: true }).select('_id');
        if (!locked) throw Object.assign(new Error('A session participant is unavailable.'), { status: 409 });
      }
      const conflict = instant && Number.isFinite(new Date(instant).getTime()) && await Session.exists({ _id: { $ne: session._id }, scheduledAt: instant,
        status: { $in: ['accepted', 'scheduled', 'in_progress', 'awaiting_validation'] },
        $or: [{ learner: { $in: participants } }, { tutor: { $in: participants } }] }).session(dbSession);
      if (conflict) throw Object.assign(new Error('A participant already has a confirmed session at this exact time. Propose another time.'), { status: 409 });
      updated = await write(dbSession);
    });
    return updated;
  } finally { await dbSession.endSession(); }
}

module.exports = { normalizeSubject, rejectDuplicateRequest, commitSchedule };
