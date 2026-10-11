const mongoose = require('mongoose');
const { createHmac, createHash } = require('node:crypto');
const Notification = require('../models/Notification');
const User = require('../models/User');
const email = require('./emailService');
const SessionMessage = require('../models/SessionMessage');
const { messagePushCooldownMinutes } = require('../config/notificationSettings');

const COPY = Object.freeze({
  'study.published': ['Study set published', 'Your study set was approved for free shared practice. Review the recorded decision.'],
  'study.rejected': ['Study set rejected', 'Your submission was rejected. Review the reason, edit privately and resubmit when ready.'],
  'study.removed': ['Study set removed', 'Your study set was removed from shared practice. Review the recorded reason.'],
  'session.requested': ['New tutoring request', 'A learner requested a tutoring session.'],
  'session.accepted': ['Session accepted', 'Your tutoring request was accepted.'],
  'session.declined': ['Session declined', 'Your tutoring request was declined.'],
  'session.cancelled': ['Session cancelled', 'A tutoring session was cancelled.'],
  'session.reschedule_proposed': ['New schedule proposed', 'Your peer proposed a new session time.'],
  'session.reschedule_accepted': ['Schedule accepted', 'Your proposed session time was accepted.'],
  'session.reschedule_declined': ['Schedule declined', 'Your proposed session time was declined.'],
  'session.reschedule_replaced': ['Proposal replaced', 'Your peer replaced an unanswered time proposal.'],
  'session.reschedule_withdrawn': ['Proposal withdrawn', 'Your peer withdrew a time proposal. The agreed time remains.'],
  'session.reschedule_expired': ['Proposal expired', 'The alternative time expired. Review the confirmed schedule.'],
  'session.reschedule_check_in_locked': ['Confirmed schedule locked', 'Your peer checked in at the agreed time. The alternative was closed.'],
  'session.upcoming': ['Session coming up', 'Your tutoring session starts soon.'],
  'session.started': ['Session started', 'Both participants have checked in.'],
  'session.awaiting_validation': ['Session needs confirmation', 'Your session is awaiting your confirmation.'],
  'session.validation_reminder': ['Completion confirmation reminder', 'Please confirm the finished session or submit a dispute. Silence never transfers credits.'],
  'session.review_referred': ['Completion review pending', 'An unresolved session was referred for staff review. No credits were transferred.'],
  'session.review_escalated': ['Session review target passed', 'A completion review is aging beyond its staff response target. Please review the evidence.'],
  'session.review_clarification': ['Session clarification requested', 'Staff requested more information. Review the request and add relevant evidence.'],
  'session.completed': ['Session completed', 'Your tutoring session was completed.'],
  'session.no_show': ['No-show reported', 'A no-show was recorded for your session.'],
  'session.disputed': ['Session disputed', 'A session dispute was submitted for review.'],
  'session.resolved': ['Session review resolved', 'Your session review has been resolved.'],
  'message.new': ['New session message', 'You have a new message.'],
  'message.unread_reminder': ['Unread session message', 'You have an unread session message.'],
  'learning.content_status': ['Learning content update', 'Your submitted learning resource was reviewed.'],
  'review.moderated': ['Review update', 'Your review visibility was updated.'],
  'account.suspended': ['Account suspended', 'Your Acadova account was suspended.'],
  'account.reactivated': ['Account reactivated', 'Your Acadova account was reactivated.'],
});

const idOf = (value) => String(value?._id || value || '');
const allowedRelated = new Set(['Session', 'LearningResource', 'LearningModule', 'Rating', 'User', 'StudySet']);

function pushAliasFor(userId) {
  const secret = process.env.ONESIGNAL_IDENTITY_SECRET?.trim();
  if (!secret || secret.length < 32 || !mongoose.isValidObjectId(idOf(userId))) return null;
  return `acadova_${createHmac('sha256', secret).update(`push-v1:${idOf(userId)}`).digest('hex')}`;
}

function linkFor(notification, role) {
  if (notification.relatedType === 'StudySet') return ['moderator', 'admin'].includes(role) ? `/${role}/study-sets?set=${notification.relatedId}` : `/study-sets/${notification.relatedId}`;
  if (notification.relatedType === 'Session' && notification.actionTarget === 'staff_review') return `/moderator/disputes?session=${notification.relatedId}`;
  if (notification.relatedType === 'Session' && notification.actionTarget === 'completion') return `/sessions/${notification.relatedId}#session-completion`;
  if (notification.relatedType === 'Session' && notification.proposal?.proposalId) {
    return `/sessions/${notification.relatedId}?target=proposal&proposalId=${encodeURIComponent(notification.proposal.proposalId)}#session-proposal`;
  }
  if (notification.relatedType === 'Session') return `/sessions/${notification.relatedId}`;
  if (notification.relatedType === 'LearningResource' || notification.relatedType === 'LearningModule') return '/learning';
  if (notification.relatedType === 'Rating') return '/sessions';
  return '/dashboard';
}

async function publish({ recipient, type, relatedType, relatedId, eventKey, deferPush = false, proposal, dbSession, actionTarget }) {
  const recipientId = idOf(recipient);
  const targetId = idOf(relatedId);
  if (!mongoose.isValidObjectId(recipientId) || !mongoose.isValidObjectId(targetId)
    || !COPY[type] || !allowedRelated.has(relatedType)
    || typeof eventKey !== 'string' || eventKey.length > 180 || !eventKey) {
    throw new Error('Invalid notification event');
  }
  if (actionTarget && (relatedType !== 'Session' || !['completion', 'staff_review'].includes(actionTarget))) throw new Error('Invalid notification action target');
  if (proposal && (!type.startsWith('session.reschedule_') || relatedType !== 'Session'
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(proposal.proposalId)
    || proposal.displayTimezone !== 'UTC' || !Number.isFinite(new Date(proposal.proposedScheduledAt).getTime())
    || !Number.isFinite(new Date(proposal.expiresAt).getTime()))) throw new Error('Invalid proposal metadata');
  try {
    const data = { recipient: recipientId, type, title: COPY[type][0],
      message: proposal ? `${COPY[type][1]} Proposed: ${new Date(proposal.proposedScheduledAt).toISOString()} (UTC). Expires: ${new Date(proposal.expiresAt).toISOString()} (UTC).` : COPY[type][1],
      relatedType, relatedId: targetId, eventKey, ...(actionTarget ? { actionTarget } : {}),
      ...(proposal ? { proposal, emailStatus: 'pending', emailNextAttemptAt: new Date() } : {}) };
    const notification = dbSession ? (await Notification.create([data], { session: dbSession }))[0]
      : await Notification.create(data);
    // Push is deliberately outside business transactions and cannot erase the in-app record.
    if (!deferPush && !dbSession) void deliverPush(notification._id).catch(() => {});
    return { notification, created: true };
  } catch (error) {
    if (dbSession) throw error; // Duplicate/conflicting writes must roll back the transaction.
    if (error.code !== 11000) throw error;
    return { notification: await Notification.findOne({ eventKey }).lean(), created: false };
  }
}

async function enqueueProposalEvent(type, session, recipients, dbSession) {
  if (!dbSession) throw new Error('Proposal notifications require the action transaction');
  const proposalId = session.rescheduleProposalId;
  const { proposalExpiry } = require('./rescheduleLifecycle');
  const actionable = typeof proposalId === 'string'
    && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(proposalId)
    && Number.isFinite(new Date(session.proposedScheduledAt).getTime());
  // Malformed historical alternatives still clear safely, with a generic Session
  // event. Never fabricate a date or actionable proposal URL for missing evidence.
  const occurrence = actionable ? proposalId : `legacy-${createHash('sha256').update(JSON.stringify([
    proposalId, session.proposedScheduledAt, session.rescheduleProposedAt,
  ])).digest('hex').slice(0, 24)}`;
  for (const recipient of [...new Set(recipients.map(idOf))]) {
    await publish({ recipient, type, relatedType: 'Session', relatedId: idOf(session),
      eventKey: `${type}:${idOf(session)}:${recipient}:${occurrence}`, deferPush: true, dbSession,
      ...(actionable ? { proposal: { proposalId, proposedScheduledAt: session.proposedScheduledAt,
        expiresAt: proposalExpiry(session), displayTimezone: 'UTC' } } : {}) });
  }
}

async function deliverProposalEmail(notificationId, now = new Date()) {
  const stale = new Date(now.getTime() - 10 * 60000);
  await Notification.updateOne({ _id: notificationId, emailStatus: 'sending',
    emailAttempts: { $gte: 3 }, emailAttemptedAt: { $lte: stale } },
  { $set: { emailStatus: 'exhausted' } });
  const record = await Notification.findOneAndUpdate({ _id: notificationId, emailAttempts: { $lt: 3 },
    $or: [{ emailStatus: { $in: ['pending', 'failed'] }, emailNextAttemptAt: { $lte: now } },
      { emailStatus: 'sending', emailAttemptedAt: { $lte: stale } }] },
  { $set: { emailStatus: 'sending', emailAttemptedAt: now }, $inc: { emailAttempts: 1 } },
  { returnDocument: 'after' }).lean();
  if (!record) return false;
  const claim = { _id: record._id, emailStatus: 'sending', emailAttemptedAt: now, emailAttempts: record.emailAttempts };
  try {
    const user = await User.findById(record.recipient).select('name email').lean();
    if (!user || !record.proposal) throw new Error('Recipient unavailable');
    await email.sendProposalEmail({ recipient: user.email, name: user.name,
      title: record.title, message: record.message, reviewPath: linkFor(record),
      deliveryKey: record.pushIdempotencyKey });
    await Notification.updateOne(claim, { $set: { emailStatus: 'accepted', emailAcceptedAt: new Date() } });
    return true;
  } catch {
    await Notification.updateOne(claim, { $set: { emailStatus: record.emailAttempts >= 3 ? 'exhausted' : 'failed',
      emailNextAttemptAt: new Date(now.getTime() + (record.emailAttempts === 1 ? 5 : 30) * 60000) } });
    return false;
  }
}

async function deliverPush(notificationId) {
  const now = new Date();
  const record = await Notification.findOneAndUpdate({ _id: notificationId,
    $or: [{ pushStatus: 'pending' }, { pushStatus: 'failed', pushAttempts: { $lt: 3 } },
      { pushStatus: 'sending', pushAttempts: { $lt: 3 },
        pushAttemptedAt: { $lt: new Date(now.getTime() - 10 * 60 * 1000) } }] },
  { $set: { pushStatus: 'sending', pushAttemptedAt: now }, $inc: { pushAttempts: 1 } },
  { returnDocument: 'after' }).lean();
  if (!record) return false;
  const appId = process.env.ONESIGNAL_APP_ID?.trim();
  const key = process.env.ONESIGNAL_REST_API_KEY?.trim();
  const alias = pushAliasFor(record.recipient);
  if (!appId || !key || !alias) {
    await Notification.updateOne({ _id: record._id }, { $set: { pushStatus: 'skipped' } });
    return false;
  }
  let webUrl;
  try {
    const base = new URL(process.env.FRONTEND_URL);
    if (base.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production'
      && base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))) throw new Error();
    const role = record.relatedType === 'StudySet' ? (await User.findById(record.recipient).select('role').lean())?.role : undefined;
    webUrl = new URL(linkFor(record, role), base.origin).toString();
  } catch { /* Push can still be delivered without a click URL. */ }
  try {
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${key}` },
      body: JSON.stringify({ app_id: appId, target_channel: 'push',
        include_aliases: { external_id: [alias] },
        headings: { en: record.title }, contents: { en: record.message },
        idempotency_key: record.pushIdempotencyKey,
        ...(webUrl ? { web_url: webUrl } : {}) }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error('Provider rejected push');
    await Notification.updateOne({ _id: record._id }, { $set: {
      pushStatus: result.id ? 'accepted' : 'unavailable',
      ...(result.id ? { pushAcceptedAt: new Date() } : {}),
    } });
    return Boolean(result.id);
  } catch {
    // Never store provider error text: it may contain request details or credentials.
    await Notification.updateOne({ _id: record._id }, { $set: { pushStatus: 'failed' } });
    return false;
  }
}

async function notifySafely(event) {
  // Existing offline controller tests have no MongoDB connection; production actions always use it.
  if (mongoose.connection.readyState !== 1) return false;
  try { return await module.exports.publish(event); }
  catch { console.warn('Notification persistence unavailable', { type: event.type }); return false; }
}

async function notifySession(type, session, recipients, occurrence = '') {
  const sessionId = idOf(session);
  const unique = [...new Set(recipients.map(idOf).filter((value) => mongoose.isValidObjectId(value)))];
  return Promise.all(unique.map((recipient) => notifySafely({ recipient, type, relatedType: 'Session',
    relatedId: sessionId, eventKey: `${type}:${sessionId}:${recipient}:${occurrence}` })));
}

async function notifyMessage(session, message, recipient) {
  if (mongoose.connection.readyState !== 1) return false;
  const recipientId = idOf(recipient);
  const sessionId = idOf(session);
  const cutoff = new Date(Date.now() - messagePushCooldownMinutes * 60 * 1000);
  const previous = await Notification.findOne({ recipient: recipientId, type: 'message.new',
    relatedId: sessionId, readAt: null, createdAt: { $gte: cutoff } }).select('_id').lean();
  if (previous) return false;
  const firstUnread = await SessionMessage.findOne({ session: sessionId,
    sender: { $ne: recipientId }, unreadForRecipient: true }).sort({ createdAt: 1 }).select('_id').lean();
  if (!firstUnread) return false;
  return notifySafely({ recipient: recipientId, type: 'message.new', relatedType: 'Session',
    relatedId: sessionId, eventKey: `message.new:${sessionId}:${recipientId}:${idOf(firstUnread._id)}` });
}

async function markThreadRead(session, reader) {
  const sessionId = idOf(session);
  const readerId = idOf(reader);
  const now = new Date();
  await SessionMessage.updateMany({ session: sessionId, sender: { $ne: readerId },
    unreadForRecipient: true }, { $set: { unreadForRecipient: false, readAt: now } });
  await Notification.updateMany({ recipient: readerId, relatedType: 'Session', relatedId: sessionId,
    type: { $in: ['message.new', 'message.unread_reminder'] }, readAt: null },
  { $set: { readAt: now } });
}

async function invalidateUpcoming(session) {
  if (mongoose.connection.readyState !== 1) return;
  try { await Notification.updateMany({ relatedType: 'Session', relatedId: idOf(session),
    type: 'session.upcoming', readAt: null }, { $set: { readAt: new Date() } }); }
  catch { console.warn('Old session reminder could not be cleared'); }
}

module.exports = { COPY, publish, deliverPush, deliverProposalEmail, enqueueProposalEvent, notifySafely, notifySession,
  notifyMessage, markThreadRead, invalidateUpcoming, linkFor, pushAliasFor };
