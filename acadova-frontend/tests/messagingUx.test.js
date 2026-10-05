import test from 'node:test';
import assert from 'node:assert/strict';
import { canMessageSession, isNearChatBottom, isChatViewed, newIncomingMessages, createNotificationTracker, threadAlerts } from '../src/utils/messagingUx.js';
import { createNotificationSound, readSoundPreference, saveSoundPreference } from '../src/services/notificationSound.js';

test('chat reads require the visible Chat interface in a foreground window, with supported raw states', () => {
  assert.equal(isChatViewed('overview', { visibilityState: 'visible', hasFocus: () => true }), false);
  assert.equal(isChatViewed('messages', { visibilityState: 'hidden', hasFocus: () => true }), false);
  assert.equal(isChatViewed('messages', { visibilityState: 'visible', hasFocus: () => false }), false);
  assert.equal(isChatViewed('messages', { visibilityState: 'visible', hasFocus: () => true }), true);
  assert.equal(isChatViewed('messages', { visibilityState: 'visible', hasFocus: () => true, querySelector: () => ({}) }), false);
  assert.equal(canMessageSession({ status: 'scheduled' }), true);
  for (const value of [{ status: 'pending' }, { status: 'disputed' }, { status: 'scheduled', canonicalStatus: 'scheduled' }, { status: 'unknown' }]) assert.equal(canMessageSession(value), false);
});
test('scroll hints count new peer messages, not own sends, duplicates, or backend unread totals', () => {
  assert.equal(isNearChatBottom({ scrollHeight: 1000, scrollTop: 820, clientHeight: 150 }), true);
  assert.equal(isNearChatBottom({ scrollHeight: 1000, scrollTop: 0, clientHeight: 150 }), false);
  const old = [{ _id: 'old', sender: { _id: 'peer' } }];
  assert.deepEqual(newIncomingMessages(old, [...old, { _id: 'own', sender: { _id: 'me' } }, { _id: 'peer-new', sender: { _id: 'peer' } }], 'me').map((row) => row._id), ['peer-new']);
});
test('notification tracker excludes historical load, old pages, read rows and repeated polls', () => {
  const track = createNotificationTracker();
  const row = (id, time, readAt = null) => ({ id, createdAt: new Date(time).toISOString(), readAt });
  assert.deepEqual(track([row('initial', 1000)]), []);
  assert.deepEqual(track([row('older', 500), row('initial', 1000)]), []);
  assert.deepEqual(track([row('new', 2000)]).map((item) => item.id), ['new']);
  assert.deepEqual(track([row('new', 2000), row('read', 3000, 'read')]), []);
  const alert = { type: 'message.new', href: '/sessions/s#session-messages', readAt: null };
  assert.equal(threadAlerts([alert, { ...alert, readAt: 'read' }], 's').length, 1);
  assert.equal(threadAlerts([alert], 'other').length, 0);
});
test('sound requires explicit audio unlock, uses cooldown, and handles blocked browsers', async () => {
  let time = 0; let played = 0;
  const context = { state: 'suspended', currentTime: 0, destination: {}, resume: async () => { context.state = 'running'; },
    createOscillator: () => ({ frequency: {}, connect() {}, start() { played++; }, stop() {}, disconnect() {} }),
    createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }), close: async () => {} };
  const player = createNotificationSound(() => context, () => time);
  assert.equal(player.play(), false); assert.equal(await player.unlock(), true);
  assert.equal(player.play(), true); assert.equal(player.play(), false);
  time = 10_000; assert.equal(player.play(), true); assert.equal(played, 2); player.close();
  assert.equal(await createNotificationSound(() => { throw new Error('Blocked'); }).unlock(), false);
});
test('sound is opt-in and its local preference is isolated by account', () => {
  const previous = globalThis.localStorage; const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  try { assert.equal(readSoundPreference('a'), false); saveSoundPreference('a', true); assert.equal(readSoundPreference('a'), true); assert.equal(readSoundPreference('b'), false); saveSoundPreference('a', false); assert.equal(readSoundPreference('a'), false); }
  finally { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; }
});
