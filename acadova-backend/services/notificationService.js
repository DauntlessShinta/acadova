const mongoose = require('mongoose');
const { createHmac } = require('node:crypto');
const Notification = require('../models/Notification');
const SessionMessage = require('../models/SessionMessage');
const { messagePushCooldownMinutes } = require('../config/notificationSettings');

const COPY = Object.freeze({
  'session.requested': ['New tutoring request', 'A learner requested a tutoring session.'],
  'session.accepted': ['Session accepted', 'Your tutoring request was accepted.'],
  'session.declined': ['Session declined', 'Your tutoring request was declined.'],
  'session.cancelled': ['Session cancelled', 'A tutoring session was cancelled.'],
  'session.reschedule_proposed': ['New schedule proposed', 'Your peer proposed a new session time.'],
  'session.reschedule_accepted': ['Schedule accepted', 'Your proposed session time was accepted.'],
  'session.reschedule_declined': ['Schedule declined', 'Your proposed session time was declined.'],
  'session.upcoming': ['Session coming up', 'Your tutoring session starts soon.'],
  'session.started': ['Session started', 'Both participants have checked in.'],
  'session.awaiting_validation': ['Session needs confirmation', 'Your session is awaiting your confirmation.'],
  'session.completed': ['Session completed', 'Your tutoring session was completed.'],
  'session.no_show': ['No-show reported', 'A no-show was recorded for your session.'],
  'session.disputed': ['Session disputed', 'A session dispute was submitted for review.'],
  'session.resolved': ['Dispute resolved', 'Your session dispute has been resolved.'],
  'message.new': ['New session message', 'You have a new message.'],
  'message.unread_reminder': ['Unread session message', 'You have an unread session message.'],
  'learning.content_status': ['Learning content update', 'Your submitted learning resource was reviewed.'],
  'review.moderated': ['Review update', 'Your review visibility was updated.'],
  'account.suspended': ['Account suspended', 'Your Acadova account was suspended.'],
  'account.reactivated': ['Account reactivated', 'Your Acadova account was reactivated.'],
});

const idOf = (value) => String(value?._id || value || '');
const allowedRelated = new Set(['Session', 'LearningResource', 'LearningModule', 'Rating', 'User']);

function pushAliasFor(userId) {
  const secret = process.env.ONESIGNAL_IDENTITY_SECRET?.trim();
  if (!secret || secret.length < 32 || !mongoose.isValidObjectId(idOf(userId))) return null;
  return `acadova_${createHmac('sha256', secret).update(`push-v1:${idOf(userId)}`).digest('hex')}`;
}

function linkFor(notification) {
  if (notification.relatedType === 'Session') return `/sessions/${notification.relatedId}`;
  if (notification.relatedType === 'LearningResource' || notification.relatedType === 'LearningModule') return '/learning';
  if (notification.relatedType === 'Rating') return '/sessions';
  return '/dashboard';
}

async function publish({ recipient, type, relatedType, relatedId, eventKey, deferPush = false }) {
  const recipientId = idOf(recipient);
  const targetId = idOf(relatedId);
  if (!mongoose.isValidObjectId(recipientId) || !mongoose.isValidObjectId(targetId)
    || !COPY[type] || !allowedRelated.has(relatedType)
    || typeof eventKey !== 'string' || eventKey.length > 180 || !eventKey) {
    throw new Error('Invalid notification event');
  }
  try {
    const notification = await Notification.create({ recipient: recipientId, type,
      title: COPY[type][0], message: COPY[type][1], relatedType, relatedId: targetId, eventKey });
    // Push is deliberately outside business transactions and cannot erase the in-app record.
    if (!deferPush) void deliverPush(notification._id).catch(() => {});
    return { notification, created: true };
  } catch (error) {
    if (error.code !== 11000) throw error;
    return { notification: await Notification.findOne({ eventKey }).lean(), created: false };
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
    webUrl = new URL(linkFor(record), base.origin).toString();
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

module.exports = { COPY, publish, deliverPush, notifySafely, notifySession,
  notifyMessage, markThreadRead, invalidateUpcoming, linkFor, pushAliasFor };
