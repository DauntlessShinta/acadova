// Actual App and CSS, isolated Session/notification fixtures; no database access.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../src/App';
import AuthContext from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import '../src/index.css';

const me = { _id: 'me', name: 'Alex Santos', role: 'student', credits: 100, onboardingFinishedAt: '2026-10-01', skillsToLearn: ['Networks'], skillsToTeach: ['Math'] };
const peer = { ...me, _id: 'peer', name: 'Nathan Santos' };
const original = { _id: 'test', subject: 'Computer Networks', learner: me, tutor: peer, status: 'scheduled', scheduledAt: new Date().toISOString(), meetingMethod: 'online', meetingLink: 'https://example.com/meeting', creditAmount: 20 };
let session = { ...original }; let currentUser = me;
let messages = Array.from({ length: 35 }, (_, index) => ({ _id: 'm' + index, sender: index % 2 ? me : peer, body: 'Study note ' + index + '\nA useful explanation for this Session.', createdAt: new Date(Date.now() - (40 - index) * 1000).toISOString() }));
let notifications = [{ id: 'historical', type: 'message.new', href: '/sessions/test', title: 'New session message', message: 'You have a new message.', readAt: null, createdAt: new Date(Date.now() - 60_000).toISOString() }];
let reads = 0; let sends = 0; let coordinationWrites = 0; let checkIns = 0; let sounds = 0; let failSend = false;
let focused = true; let visibility = 'visible';
document.hasFocus = () => focused;
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
const interval = window.setInterval.bind(window);
window.setInterval = (callback, delay, ...args) => interval(callback, [5000, 60_000].includes(delay) ? 180 : delay, ...args);
class FakeAudioContext {
  state = 'suspended'; currentTime = 0; destination = {};
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
  createOscillator() { return { frequency: {}, connect() {}, start() { sounds++; }, stop() {}, disconnect() {} }; }
  createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
}
window.AudioContext = FakeAudioContext;
window.fetch = async (url, options = {}) => {
  const route = new URL(String(url), 'https://fixture.test').pathname;
  let data = [];
  if (route === '/api/sessions') data = [session];
  if (route === '/api/sessions/test') data = session;
  if (route === '/api/sessions/test/messages') {
    if (options.method === 'POST') {
      sends++;
      if (failSend) return new Response(JSON.stringify({ message: 'Connection unavailable. Your draft is still here.' }), { status: 503 });
      const body = JSON.parse(options.body).body;
      data = { _id: 'own-' + sends, body, sender: currentUser, createdAt: new Date().toISOString() }; messages.push(data);
    } else { reads++; notifications.forEach((item) => { if (item.href === '/sessions/test' && item.type.startsWith('message.')) item.readAt = new Date().toISOString(); }); data = messages; }
  }
  if (route === '/api/sessions/test/check-in') { checkIns++; session = { ...session, learnerCheckedInAt: new Date().toISOString() }; data = session; }
  if (route === '/api/sessions/test/coordination') { coordinationWrites++; session = { ...session, ...JSON.parse(options.body) }; data = session; }
  if (route === '/api/notifications/unread-count') data = { count: notifications.filter((item) => !item.readAt).length };
  if (route === '/api/notifications') data = notifications;
  return new Response(JSON.stringify({ success: true, data, message: 'Saved' }), { status: 200 });
};
const pause = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (value, label) => { if (!value) throw new Error(label); };
const until = async (check, label) => { for (let i = 0; i < 150; i++) { if (check()) return; await pause(); } throw new Error(label); };
const visible = (selector) => [...document.querySelectorAll(selector)].filter((element) => element.getClientRects().length);
const root = createRoot(document.getElementById('root')); let key = 0;
// oxlint-disable-next-line react/only-export-components
function Probe() { const location = useLocation(); return <span hidden id="route-probe" data-path={location.pathname} />; }
const render = async (path, user = me) => {
  const previous = document.querySelector('#route-probe'); currentUser = user;
  root.render(<AuthContext.Provider value={{ user, credits: 100, loading: false, isAuthenticated: true, refreshUser: async () => {} }}><ToastProvider><ConfirmProvider><MemoryRouter key={++key} initialEntries={[path]}><App /><Probe /></MemoryRouter></ConfirmProvider></ToastProvider></AuthContext.Provider>);
  await until(() => document.querySelector('#route-probe') !== previous && document.querySelector('#route-probe')?.dataset.path === path.split(/[?#]/)[0], 'Route commit');
};
const tab = async (name) => { document.getElementById('room-tab-' + name).click(); await pause(); };
const fill = (selector, value) => { const input = document.querySelector(selector); Object.getOwnPropertyDescriptor(input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); };
const openMessages = () => { const entry = document.querySelector('button[aria-label="Messages"]'); entry.focus(); entry.click(); };
const incoming = (id) => { messages.push({ _id: id, sender: peer, body: 'New study detail ' + id, createdAt: new Date().toISOString() }); notifications.unshift({ id: 'notice-' + id, type: 'message.new', href: '/sessions/test', title: 'New session message', message: 'You have a new message.', readAt: null, createdAt: new Date().toISOString() }); };
const checks = []; const errors = [];
window.addEventListener('error', (event) => errors.push(event.message)); window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason)));
try {
  await render('/sessions/test'); await until(() => document.querySelector('#room-tab-overview'), 'Session Room'); await pause(400);
  assert(reads === 0, 'Overview cleared unread chat'); assert(sounds === 0, 'Historical load played sound');
  assert(visible('[role="tab"]').map((node) => node.textContent).join('|') === 'Overview|Chat|Progress|Details', 'Four workflow tabs');
  document.getElementById('room-tab-overview').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await pause();
  assert(document.activeElement.id === 'room-tab-messages', 'Keyboard Chat navigation');
  await until(() => document.querySelectorAll('.session-message').length === 35, 'Initial messages'); await pause();
  const log = document.querySelector('.session-messages');
  const atBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 4;
  assert(atBottom(), 'Initial Chat did not open at bottom');
  incoming('near-bottom'); await until(() => document.querySelectorAll('.session-message').length === 36, 'Near-bottom polling'); await pause(); assert(atBottom(), 'Near-bottom follow failed');
  log.scrollTop = 0; log.dispatchEvent(new Event('scroll')); await pause();
  incoming('reading-older'); await until(() => visible('.chat-new-messages').length, 'New-message hint');
  assert(log.scrollTop < 24, 'Polling forced old-message reader to bottom');
  assert(document.querySelector('.chat-new-messages').textContent.startsWith('1 new message'), 'New hint count');
  await pause(400); assert(document.querySelector('.chat-new-messages').textContent.startsWith('1 new message'), 'Duplicate poll hint');
  document.querySelector('.chat-new-messages').click(); await pause(); assert(atBottom() && !visible('.chat-new-messages').length, 'Newest-message action');
  const bell = document.querySelector('.notification-trigger'); bell.click(); await until(() => document.querySelector('.notification-sound'), 'Sound preference');
  document.querySelector('.notification-sound').click(); await pause();
  assert(localStorage.getItem('acadova:sound:me') === 'on' && sounds === 0, 'Opt-in replayed history');
  document.querySelector('.notification-panel-header button[aria-label="Close notifications"]').click();
  incoming('active-chat'); await until(() => document.querySelectorAll('.session-message').length === 38, 'Active-thread poll'); await pause(250); assert(sounds === 0, 'Active Chat sounded');
  log.scrollTop = 0; log.dispatchEvent(new Event('scroll')); fill('#session-message', 'My useful reply'); await pause();
  document.querySelector('.message-composer').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => document.querySelectorAll('.session-message').length === 39, 'Send success'); await pause();
  assert(atBottom() && document.querySelector('#session-message').value === '' && sounds === 0, 'Own send scroll/draft/sound');
  failSend = true; fill('#session-message', 'Preserve this draft'); await pause();
  document.querySelector('.message-composer').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => document.querySelector('#session-message-error'), 'Send error'); assert(document.querySelector('#session-message').value === 'Preserve this draft', 'Failed draft lost'); failSend = false;
  await tab('overview'); await pause(200); const overviewReads = reads; await pause(400); assert(reads === overviewReads, 'Hidden Chat polled');
  await tab('messages'); await pause(250); assert(document.querySelector('#session-message').value === 'Preserve this draft', 'Tab switch lost draft');
  focused = false; window.dispatchEvent(new Event('blur')); await pause(200); const blurReads = reads; await pause(400); assert(reads === blurReads, 'Inactive window cleared unread');
  focused = true; visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); await pause(200); const hiddenReads = reads; await pause(400); assert(reads === hiddenReads, 'Hidden document read chat');
  visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); await pause(250);
  await tab('details'); incoming('outside-chat'); await until(() => sounds === 1, 'New incoming sound'); incoming('rapid-followup'); await pause(400); assert(sounds === 1, 'Rapid sound spam');
  bell.click(); await until(() => document.querySelector('.notification-sound'), 'Mute'); document.querySelector('.notification-sound').click(); await pause(); assert(localStorage.getItem('acadova:sound:me') === 'off', 'Mute preference not saved');
  document.querySelector('.notification-panel-header button[aria-label="Close notifications"]').click();
  checks.push('Initial/near-bottom/up-scroll Chat, new hint, send/draft failure, tab/focus/visibility read gating, historical/own/active-thread sound suppression, cooldown and mute');
  openMessages(); await until(() => document.querySelector('.conversation-link'), 'Messages picker');
  await pause(300); const drawer = document.querySelector('.messages-drawer'); assert(drawer && drawer.textContent.includes('Nathan Santos'), 'Participant conversation context');
  assert(drawer.textContent.includes('Unread message alert'), 'Authoritative notification alert missing');
  assert(document.documentElement.scrollWidth <= innerWidth, 'Messaging drawer overflow');
  assert(innerWidth > 1024 ? drawer.getBoundingClientRect().width <= 420 : drawer.getBoundingClientRect().width >= document.documentElement.clientWidth - 2, 'Responsive Messages drawer');
  const pickerReads = reads; await pause(250); assert(reads === pickerReads, 'Conversation picker read messages');
  document.querySelector('.conversation-link').click(); await until(() => !document.querySelector('.messages-drawer') && visible('#room-panel-messages').length, 'Single full-room Chat');
  await tab('details');
  assert(document.querySelector('#route-probe').dataset.path === '/sessions/test', 'Same Session route');
  openMessages(); await until(() => document.querySelector('.conversation-link'), 'Same conversation picker');
  document.querySelector('.conversation-link').click();
  await until(() => !document.querySelector('.messages-drawer') && visible('#room-panel-messages').length, 'Same URL/hash must reactivate Chat');
  assert(document.querySelector('#session-message').value === 'Preserve this draft', 'Same conversation navigation lost draft');
  checks.push('Same conversation/hash after Details always opens Chat and retains the draft');
  assert(document.querySelectorAll('.message-composer').length === 1, 'Duplicate chat state');
  openMessages(); await until(() => document.querySelector('.messages-drawer'), 'Covered Chat picker');
  await pause(250); const coveredReads = reads; await pause(400); assert(reads === coveredReads, 'Modal-covered Chat cleared unread');
  document.querySelector('.messages-drawer').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await pause();
  assert(!document.querySelector('.messages-drawer') && document.activeElement.getAttribute('aria-label') === 'Messages', 'Messages Escape/focus restoration');

  const meeting = document.querySelector('a[href="https://example.com/meeting"]'); assert(meeting?.target === '_blank' && meeting.rel.includes('noopener') && meeting.rel.includes('noreferrer'), 'Meeting safety');
  await tab('overview'); document.querySelector('.session-next-step button').click(); await until(() => checkIns === 1, 'Legitimate check-in'); assert(!document.querySelector('[role="dialog"]'), 'Harmless check-in confirmation');
  session = { ...original, meetingMethod: 'in-person', meetingLink: undefined, location: 'University Library - Study Area 2' };
  await render('/sessions/test'); await until(() => document.querySelector('.session-meeting-result strong'), 'Face-to-face location'); assert(document.body.textContent.includes('University Library') && !document.querySelector('a[href="https://example.com/meeting"]'), 'Face-to-face presentation');
  session = { ...original, meetingLink: '' }; await render('/sessions/test', peer); await until(() => document.querySelector('#room-tab-details'), 'Tutor Room'); await tab('details');
  fill('#meeting-detail', 'https://example.com/first'); await pause(); document.querySelector('.coordination-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => coordinationWrites === 1 && document.querySelector('a[href="https://example.com/first"]') && !document.querySelector('.coordination-form button').disabled, 'First meeting save'); assert(!document.querySelector('[role="dialog"]'), 'First link asked confirmation');
  fill('#meeting-detail', 'https://example.com/replacement'); await pause(); document.querySelector('.coordination-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => document.querySelector('[role="dialog"]'), 'Replacement confirmation'); [...document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent === 'Cancel').click(); await pause(); assert(coordinationWrites === 1, 'Cancelled replacement wrote');
  session = { ...original, canonicalStatus: 'future_status' }; await render('/sessions/test', peer); await until(() => document.querySelector('#room-tab-details'), 'Unsupported contract'); await tab('details'); assert(!document.querySelector('.coordination-form'), 'Unsupported state allowed editing');
  await tab('messages'); assert(!document.querySelector('.message-composer'), 'Unsupported state allowed messaging');
  checks.push('Messages picker, one Chat, safe meeting link, check-in, face-to-face location, first-save/replacement confirmation and unsupported read-only state');
  session = { ...original }; await render('/sessions/test#session-messages'); await until(() => document.querySelectorAll('.session-message').length === messages.length, 'Capture Chat'); await pause();
  document.querySelectorAll('.app-toast button').forEach((button) => button.click()); await pause();
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  assert(document.documentElement.scrollWidth <= innerWidth, 'Session Room overflow');
  assert(visible('.student-sidebar').length === (innerWidth > 1024 ? 1 : 0) && visible('.student-mobile-bottom').length === (innerWidth > 1024 ? 0 : 1), 'Shell breakpoint');
  assert(errors.length === 0, 'Runtime errors: ' + errors.join('; '));
  document.getElementById('result').textContent = `PASS: ${innerWidth}x${innerHeight} P7.1B\n${checks.join('\n')}`;
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.message + '\n' + checks.join('\n'); }
if (document.getElementById('result').textContent.startsWith('PASS:')) document.getElementById('result').hidden = true;
