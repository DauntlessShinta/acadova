export const idOf = (value) => String(value?._id || value?.id || value || '');
export const canMessageSession = (session) => session?.canonicalStatus == null
  && ['accepted', 'scheduled', 'in_progress', 'awaiting_validation', 'completed'].includes(session?.status);
export const isNearChatBottom = (list) => list.scrollHeight - list.scrollTop - list.clientHeight < 72;
export const isChatViewed = (section, doc = document) => section === 'messages'
  && doc.visibilityState === 'visible' && doc.hasFocus()
  && !doc.querySelector?.('[role="dialog"][aria-modal="true"]');
export const threadFromNotification = (item) => /^\/sessions\/([^/?#]+)(?:[?#]|$)/.exec(item.href || '')?.[1] || '';
export const threadAlerts = (items, sessionId) => items.filter((item) => !item.readAt
  && item.type?.startsWith('message.') && threadFromNotification(item) === idOf(sessionId));

// This is a scroll-position hint, not an invented backend unread count.
export function newIncomingMessages(previous, current, userId) {
  const known = new Set(previous.map((message) => idOf(message)));
  return current.filter((message) => !known.has(idOf(message)) && idOf(message.sender) !== idOf(userId));
}

export function createNotificationTracker() {
  let initialized = false;
  let floor = 0;
  const seen = new Set();
  return (items, now = Date.now()) => {
    if (!initialized) {
      initialized = true;
      floor = items.length ? Math.max(...items.map((item) => Date.parse(item.createdAt) || 0)) : now;
      items.forEach((item) => seen.add(item.id));
      return [];
    }
    const incoming = items.filter((item) => !seen.has(item.id) && !item.readAt && Date.parse(item.createdAt) > floor);
    items.forEach((item) => seen.add(item.id));
    if (seen.size > 500) { seen.clear(); items.forEach((item) => seen.add(item.id)); floor = Math.max(floor, ...items.map((item) => Date.parse(item.createdAt) || 0)); }
    return incoming;
  };
}
