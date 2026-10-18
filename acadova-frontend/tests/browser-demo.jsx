// Real React components, isolated in-memory API. No application login or DB writes.
import React from 'react';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import { ToastProvider } from '../src/context/ToastContext';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AuthContext from '../src/context/AuthContext';
import SessionRoomPage from '../src/pages/SessionRoomPage';
import ProfilePage from '../src/pages/ProfilePage';

// Fixed test clock keeps the existing 15-minute/4-hour check-in window deterministic.
const NativeDate = window.Date; const fixtureNow = NativeDate.parse('2026-09-25T06:30:00.000Z');
window.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [fixtureNow])); } static now() { return fixtureNow; } };
const checks = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const pause = () => new Promise((resolve) => setTimeout(resolve, 25));
const until = async (condition, message) => {
  for (let i = 0; i < 100; i += 1) { if (condition()) return; await pause(); }
  throw new Error(message);
};
const text = () => document.getElementById('root').textContent + (document.querySelector('.toast-viewport')?.textContent || '');
const button = (label) => [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === label || item.getAttribute('aria-label') === label);
const fill = (selector, value) => {
  const input = document.querySelector(selector);
  assert(input, `Missing input ${selector}`);
  const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const submit = (selector) => document.querySelector(selector).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
const clone = (value) => JSON.parse(JSON.stringify(value));
let visible = true;
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visible ? 'visible' : 'hidden' });
const intervals = new Map();
let intervalNumber = 0;
window.setInterval = (callback, delay) => { const id = ++intervalNumber; intervals.set(id, { callback, delay }); return id; };
window.clearInterval = (id) => intervals.delete(id);
const acceptDecisions = new MutationObserver(() => {
  const decision = [...document.querySelectorAll('.modal-footer button')].find((item) => item.textContent !== 'Cancel');
  decision?.click();
});
acceptDecisions.observe(document.body, { childList: true, subtree: true });
const tick = () => { for (const timer of intervals.values()) timer.callback(); };
const learner = { _id: 'learner', name: 'User A', role: 'student', credits: 2, skillsToTeach: ['Java'], skillsToLearn: ['React'] };
const tutor = { _id: 'tutor', name: 'User B', role: 'student', credits: 2, skillsToTeach: ['React'], skillsToLearn: ['Java'] };
let actor = learner;
let session = { _id: 'demo', learner, tutor, subject: 'Demo React', lifecycleVersion: 1, status: 'pending', scheduledAt: '2026-09-25T06:30:00.000Z', meetingMethod: 'online', requestMessage: 'Help with state', creditAmount: 1 };
const reviews = new Set();
const messages = [];
let reads = 0;
let writes = 0;
let holdRead = false;
let releaseRead;
let walletRefreshes = 0;
window.fetch = async (url, options = {}) => {
  assert(String(url).startsWith('/api/'), 'Unexpected external request');
  const method = options.method || 'GET';
  const payload = options.body ? JSON.parse(options.body) : {};
  let data;
  if (method !== 'GET') writes += 1;
  if (url === '/api/sessions/demo' && method === 'GET') {
    reads += 1;
    data = { ...clone(session), myReview: reviews.has(actor._id), ratingEligible: session.status === 'completed' && Boolean(session.creditsSettledAt) };
    if (holdRead) { holdRead = false; await new Promise((resolve) => { releaseRead = resolve; }); }
  } else if (url === '/api/sessions/demo/messages') {
    if (method === 'POST') {
      data = { _id: String(messages.length), sender: clone(actor), body: payload.body, createdAt: new Date().toISOString() };
      messages.push(data);
    } else data = clone(messages);
  } else if (url === '/api/sessions/demo/coordination') {
    Object.assign(session, payload); data = clone(session);
  } else if (url === '/api/sessions/demo/status') {
    session.status = payload.status; data = clone(session);
  } else if (url === '/api/sessions/demo/check-in') {
    assert(payload.expectedScheduledAt === session.scheduledAt, 'Check-in pins the agreed schedule');
    session[actor._id === tutor._id ? 'tutorCheckedInAt' : 'learnerCheckedInAt'] = new Date().toISOString();
    if (session.learnerCheckedInAt && session.tutorCheckedInAt) { session.status = 'in_progress'; session.startedAt = new Date().toISOString(); } data = clone(session);
  } else if (url === '/api/sessions/demo/finish') {
    assert(actor._id === tutor._id && session.status === 'in_progress' && session.startedAt, 'Only checked-in tutor finishes');
    session.status = 'awaiting_validation'; session.awaitingValidationAt = new Date().toISOString(); data = clone(session);
  } else if (url === '/api/sessions/demo/confirm') {
    assert(session.status === 'awaiting_validation' && !session.creditsSettledAt, 'Separate confirmations precede settlement');
    session[actor._id === tutor._id ? 'tutorConfirmedAt' : 'learnerConfirmedAt'] = new Date().toISOString();
    if (session.learnerConfirmedAt && session.tutorConfirmedAt) { session.status = 'completed'; session.confirmedAt = session.creditsSettledAt = new Date().toISOString(); } data = clone(session);
  } else if (url === '/api/ratings') {
    reviews.add(actor._id); data = { _id: 'review' };
  } else if (url === '/api/users/me') {
    if (method === 'PATCH') Object.assign(actor, payload);
    data = clone(actor);
  } else throw new Error(`Unexpected API request ${method} ${url}`);
  return { ok: true, status: 200, json: async () => ({ success: true, message: 'Saved', data }) };
};
let root;
const refreshUser = async () => { walletRefreshes += 1; return actor; };
const render = (page = 'room', reset = true) => {
  if (reset) { root?.unmount(); root = createRoot(document.getElementById('root')); }
  root.render(<AuthContext.Provider value={{ user: actor, credits: actor.credits, refreshUser }}><ToastProvider><ConfirmProvider>
    <MemoryRouter initialEntries={['/sessions/demo']}>
      {page === 'profile' ? <ProfilePage /> : <Routes><Route path="/sessions/:id" element={<SessionRoomPage />} /></Routes>}
    </MemoryRouter>
  </ConfirmProvider></ToastProvider></AuthContext.Provider>);
};
const idle = async () => {
  await pause();
  await until(() => button('Refresh session') && !button('Refresh session').disabled, 'Room did not finish refreshing');
};

try {
  render(); await idle();
  assert([...intervals.values()].some((timer) => timer.delay === 5000), 'Polling must run every 5000 ms');
  session.status = 'scheduled';
  tick(); await until(() => document.querySelector('#session-message'), 'Polling did not reveal acceptance'); await idle();
  checks.push('5-second whole-room polling reveals acceptance');

  visible = false; const beforeHidden = reads; tick(); await pause();
  assert(reads === beforeHidden, 'Hidden room polled');
  session.meetingLink = 'https://example.com/focus'; visible = true;
  window.dispatchEvent(new Event('focus')); await idle();
  assert(document.querySelector('a[href="https://example.com/focus"]'), 'Focus did not refresh details');
  session.meetingLink = 'https://example.com/visibility';
  document.dispatchEvent(new Event('visibilitychange')); await idle();
  assert(document.querySelector('a[href="https://example.com/visibility"]'), 'Visibility did not refresh details');
  checks.push('hidden polling paused; focus and visibility refresh details');

  session.meetingLink = 'https://example.com/manual'; button('Refresh session').click(); await idle();
  assert(document.querySelector('a[href="https://example.com/manual"]'), 'Manual refresh only refreshed messages');
  checks.push('manual whole-session refresh');

  actor = tutor; render(); await idle();
  fill('#meeting-detail', 'https://example.com/unsaved'); await pause(); tick(); await idle();
  assert(document.querySelector('#meeting-detail').value === 'https://example.com/unsaved', 'Poll erased meeting draft');
  window.dispatchEvent(new Event('focus')); await idle();
  assert(document.querySelector('#meeting-detail').value === 'https://example.com/unsaved', 'Focus erased meeting draft');
  submit('.coordination-form'); await idle();
  assert(session.meetingLink === 'https://example.com/unsaved', 'Meeting details did not save');
  checks.push('unsaved meeting draft survives polling/focus and saves');

  button('Chat').click(); await pause();
  fill('#session-message', 'Message from B'); await pause(); submit('.message-composer'); await idle();
  actor = learner; render(); await idle(); button('Chat').click(); await until(() => text().includes('Message from B'), 'A cannot see B message');
  fill('#session-message', 'Message from A'); await pause(); submit('.message-composer'); await idle();
  actor = tutor; render(); await idle(); button('Chat').click(); await until(() => text().includes('Message from A'), 'B cannot see A message');
  checks.push('both participants send and receive messages');

  actor = learner; render(); await idle(); button('Check in').click(); await until(() => session.learnerCheckedInAt, 'Learner check-in'); await idle();
  assert(session.status === 'scheduled' && !session.creditsSettledAt, 'One check-in cannot start or settle');
  actor = tutor; render(); await idle(); button('Check in').click(); await until(() => session.status === 'in_progress', 'Both check-ins start'); await idle();
  assert(!session.creditsSettledAt && !document.querySelector('#review-heading'), 'Attendance is not settlement/review eligibility');
  checks.push('deterministic valid schedule, two independent check-ins, no premature credits or reviews');
  holdRead = true; tick(); await until(() => releaseRead, 'Slow response was not captured');
  button('Finish live session').click(); await until(() => session.status === 'awaiting_validation', 'Tutor finish failed'); await idle();
  releaseRead(); await pause();
  assert(!button('Finish live session'), 'Stale read restored in-progress status');
  assert(text().includes('Session validation'), 'Validation state disappeared');
  assert(!document.querySelector('#review-heading'), 'Review appeared before settlement evidence');
  checks.push('slow pre-mutation response cannot restore old status');

  actor = learner; render(); await idle();
  button('Confirm session').click(); await until(() => session.learnerConfirmedAt, 'Learner confirmation'); await idle();
  assert(!session.creditsSettledAt && !document.querySelector('#review-heading'), 'First confirmation cannot settle or unlock reviews');
  actor = tutor; render(); await idle(); button('Confirm session').click(); await until(() => session.creditsSettledAt, 'Second confirmation settles'); await idle();
  actor = learner; render(); await idle();
  assert(session.creditsSettledAt && walletRefreshes > 0, 'Confirmation not reflected');
  fill('#rating-comment', 'Clear explanation'); await pause(); submit('#review-heading + form'); await idle();
  assert(!document.querySelector('#review-heading'), 'Review form returned after post-submit refresh');
  render(); await idle(); assert(!document.querySelector('#review-heading'), 'Review form returned on remount');
  assert(text().includes('Your review for this session has been submitted.'), 'Persisted review state not shown');
  actor = tutor; render(); await idle(); assert(document.querySelector('#review-heading'), 'A review blocked B review');
  checks.push('review state survives refresh/remount and is participant-specific');

  session = { ...session, status: 'accepted', meetingMethod: undefined, confirmedAt: undefined, creditsSettledAt: undefined };
  const legacy = JSON.stringify(session); const beforeLegacyWrites = writes;
  render(); await idle(); tick(); await idle();
  assert(text().includes('This older session'), 'Legacy explanation missing');
  assert(!document.querySelector('.coordination-form'), 'Legacy record offered invalid coordination form');
  assert(JSON.stringify(session) === legacy && writes === beforeLegacyWrites, 'Legacy reads mutated data');
  checks.push('legacy display and refresh leave historical data unchanged');

  actor = clone(learner); render('profile'); await until(() => document.querySelector('#name'), 'Profile did not mount');
  fill('#name', 'Unsaved A');
  fill('.tag-input-field', 'DraftSkill');
  document.querySelector('.tag-input-field').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await pause();
  actor = { ...actor, name: 'Background A', skillsToTeach: ['ServerSkill'], credits: 9 };
  render('profile', false); await pause();
  assert(document.querySelector('#name').value === 'Unsaved A', 'Account refresh erased name draft');
  assert(text().includes('DraftSkill') && !text().includes('ServerSkill'), 'Account refresh erased skill draft');
  submit('form'); await until(() => text().includes('Profile and academic skills updated.'), 'Profile save failed');
  assert(actor.name === 'Unsaved A' && actor.skillsToTeach.includes('DraftSkill'), 'Saved profile differs from draft');
  actor = clone(tutor); render('profile', false); await pause();
  assert(document.querySelector('#name').value === tutor.name, 'Switching account retained prior draft');
  checks.push('profile name/skill drafts survive account refresh, save, and reset for another account');
  root.unmount(); window.Date = NativeDate; assert(intervals.size === 0, 'Polling listeners survived unmount');
  document.getElementById('result').textContent = `PASS: ${checks.length} browser checks\n${checks.join('\n')}`;
} catch (error) {
  window.Date = NativeDate;
  document.getElementById('result').textContent = `FAIL: ${error.message}\nPassed: ${checks.join('; ')}\nUI: ${text().slice(0, 1000)}`;
}
