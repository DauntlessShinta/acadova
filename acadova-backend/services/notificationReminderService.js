const Session = require('../models/Session');
const SessionMessage = require('../models/SessionMessage');
const Notification = require('../models/Notification');
const { publish, deliverPush } = require('./notificationService');
const { unreadReminderMinutes, sessionReminderMinutes } = require('../config/notificationSettings');

const idOf = (value) => String(value?._id || value || '');

async function scanUpcoming(now) {
  const horizon = new Date(now.getTime() + sessionReminderMinutes * 60 * 1000);
  const sessions = await Session.find({ status: { $in: ['scheduled', 'accepted'] },
    scheduledAt: { $gt: now, $lte: horizon }, rescheduleProposalId: null })
    .select('_id learner tutor scheduledAt').limit(200).lean();
  let created = 0;
  for (const session of sessions) {
    for (const recipient of [session.learner, session.tutor]) {
      const event = await publish({ recipient, type: 'session.upcoming', relatedType: 'Session',
        relatedId: session._id, eventKey: `session.upcoming:${idOf(session._id)}:${idOf(recipient)}:${new Date(session.scheduledAt).toISOString()}`,
        deferPush: true });
      if (event.created) { created += 1; await deliverPush(event.notification._id); }
    }
  }
  return created;
}

async function scanUnreadMessages(now) {
  const cutoff = new Date(now.getTime() - unreadReminderMinutes * 60 * 1000);
  const bursts = await SessionMessage.aggregate([
    { $match: { unreadForRecipient: true, createdAt: { $lte: cutoff } } },
    { $sort: { createdAt: 1, _id: 1 } },
    { $group: { _id: { session: '$session', sender: '$sender' }, firstMessageId: { $first: '$_id' } } },
    { $limit: 200 },
  ]);
  let created = 0;
  for (const burst of bursts) {
    const session = await Session.findById(burst._id.session).select('learner tutor').lean();
    if (!session) continue;
    const sender = idOf(burst._id.sender);
    const recipient = idOf(session.learner) === sender ? session.tutor
      : idOf(session.tutor) === sender ? session.learner : null;
    if (!recipient || !await SessionMessage.exists({ _id: burst.firstMessageId,
      session: session._id, unreadForRecipient: true })) continue;
    const event = await publish({ recipient, type: 'message.unread_reminder', relatedType: 'Session',
      relatedId: session._id, eventKey: `message.unread_reminder:${idOf(session._id)}:${idOf(recipient)}:${idOf(burst.firstMessageId)}`,
      deferPush: true });
    if (event.created) { created += 1; await deliverPush(event.notification._id); }
  }
  return created;
}

async function retryPush() {
  const stale = new Date(Date.now() - 10 * 60 * 1000);
  const rows = await Notification.find({ $or: [
    { pushStatus: 'pending' }, { pushStatus: 'failed', pushAttempts: { $lt: 3 } },
    { pushStatus: 'sending', pushAttempts: { $lt: 3 }, pushAttemptedAt: { $lt: stale } },
  ] }).select('_id').sort({ createdAt: 1 }).limit(50).lean();
  for (const row of rows) await deliverPush(row._id);
  return rows.length;
}

async function runReminderScan(now = new Date()) {
  return { upcoming: await scanUpcoming(now), unread: await scanUnreadMessages(now),
    pushRetried: await retryPush() };
}

module.exports = { scanUpcoming, scanUnreadMessages, retryPush, runReminderScan };
