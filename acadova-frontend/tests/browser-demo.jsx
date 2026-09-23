// Real React components, isolated in-memory API. No application login or DB writes.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AuthContext from '../src/context/AuthContext';
import SessionRoomPage from '../src/pages/SessionRoomPage';
import ProfilePage from '../src/pages/ProfilePage';

const checks = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const pause = () => new Promise((resolve) => setTimeout(resolve, 25));
const until = async (condition, message) => {
  for (let i = 0; i < 100; i += 1) { if (condition()) return; await pause(); }
  throw new Error(message);
};
const text = () => document.getElementById('root').textContent;
const button = (label) => [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === label);
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
window.confirm = () => true;
const tick = () => { for (const timer of intervals.values()) timer.callback(); };
const learner = { _id: 'learner', name: 'User A', role: 'student', credits: 2, skillsToTeach: ['Java'], skillsToLearn: ['React'] };
const tutor = { _id: 'tutor', name: 'User B', role: 'student', credits: 2, skillsToTeach: ['React'], skillsToLearn: ['Java'] };
let actor = learner;
let session = { _id: 'demo', learner, tutor, subject: 'Demo React', status: 'pending', scheduledAt: '2026-09-25T06:30:00.000Z', meetingMethod: 'online', requestMessage: 'Help with state', creditAmount: 1 };
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
    data = { ...clone(session), myReview: reviews.has(actor._id) };
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
  } else if (url === '/api/sessions/demo/confirm') {
    session.confirmedAt = session.creditsSettledAt = new Date().toISOString(); data = clone(session);
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
  root.render(<AuthContext.Provider value={{ user: actor, credits: actor.credits, refreshUser }}>
    <MemoryRouter initialEntries={['/sessions/demo']}>
      {page === 'profile' ? <ProfilePage /> : <Routes><Route path="/sessions/:id" element={<SessionRoomPage />} /></Routes>}
    </MemoryRouter>
  </AuthContext.Provider>);
};
const idle = async () => {
  await pause();
  await until(() => button('Refresh session') && !button('Refresh session').disabled, 'Room did not finish refreshing');
};

try {
  render(); await idle();
  assert([...intervals.values()].some((timer) => timer.delay === 5000), 'Polling must run every 5000 ms');
  session.status = 'accepted';
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

  fill('#session-message', 'Message from B'); await pause(); submit('.message-composer'); await idle();
  actor = learner; render(); await idle(); assert(text().includes('Message from B'), 'A cannot see B message');
  fill('#session-message', 'Message from A'); await pause(); submit('.message-composer'); await idle();
  actor = tutor; render(); await idle(); assert(text().includes('Message from A'), 'B cannot see A message');
  checks.push('both participants send and receive messages');

  holdRead = true; tick(); await until(() => releaseRead, 'Slow response was not captured');
  button('Complete session').click(); await until(() => session.status === 'completed', 'Tutor completion failed'); await idle();
  releaseRead(); await pause();
  assert(!button('Complete session'), 'Stale read restored accepted status');
  assert(text().includes('Awaiting confirmation'), 'Completion state disappeared');
  checks.push('slow pre-mutation response cannot restore old status');

  actor = learner; render(); await idle();
  button('Confirm completion and transfer 1 credit').click(); await idle();
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
  submit('form'); await until(() => text().includes('successfully updated'), 'Profile save failed');
  assert(actor.name === 'Unsaved A' && actor.skillsToTeach.includes('DraftSkill'), 'Saved profile differs from draft');
  actor = clone(tutor); render('profile', false); await pause();
  assert(document.querySelector('#name').value === tutor.name, 'Switching account retained prior draft');
  checks.push('profile name/skill drafts survive account refresh, save, and reset for another account');
  root.unmount(); assert(intervals.size === 0, 'Polling listeners survived unmount');
  document.getElementById('result').textContent = `PASS: ${checks.length} browser checks\n${checks.join('\n')}`;
} catch (error) {
  document.getElementById('result').textContent = `FAIL: ${error.message}\nPassed: ${checks.join('; ')}\nUI: ${text().slice(0, 1000)}`;
}
