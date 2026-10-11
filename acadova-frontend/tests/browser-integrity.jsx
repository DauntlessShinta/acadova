// Actual routed React app, focus and controls. Backend responses are isolated fixtures.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import '../src/index.css';
const learner = { _id: '507f1f77bcf86cd799439011', name: 'Learner Fixture', email: 'learner@example.test', role: 'student',
  emailVerified: true, credits: 100, skillsToLearn: ['Java'], skillsToTeach: ['Math'], onboardingFinishedAt: '2026-10-01' };
let tutor = { ...learner, _id: '507f1f77bcf86cd799439012', name: 'Tutor Fixture', skillsToTeach: ['Java Arrays', 'Python'] };
const sessionId = '507f1f77bcf86cd799439013';
const firstId = '11111111-2222-4333-8444-555555555555';
const secondId = '22222222-2222-4333-8444-555555555555';
const thirdId = '33333333-2222-4333-8444-555555555555';
let room;
let writes = []; let requestBody; let loginCalls = 0;
const scheduledAt = new Date(Date.now() + 5 * 60000).toISOString();
const fresh = () => ({ _id: sessionId, learner, tutor, subject: 'Historical Java', status: 'scheduled', scheduledAt,
  meetingMethod: 'online', meetingLink: 'https://example.test/meeting', creditAmount: 20,
  proposedScheduledAt: new Date(Date.now() + 60 * 60000).toISOString(), rescheduleProposalId: firstId,
  rescheduleProposedBy: tutor._id, rescheduleProposedAt: new Date().toISOString(),
  rescheduleExpiresAtEffective: new Date(Date.now() + 60 * 60000).toISOString(), proposalStatus: 'active' });
room = fresh();
const reply = (data, status = 200, message = '') => new Response(JSON.stringify({ success: status < 400, data, message }), { status });
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  const body = options.body ? JSON.parse(options.body) : null;
  if (path === '/api/auth/login') { loginCalls++; return reply({ user: learner, token: 'fixture' }); }
  if (path === '/api/users/me') return reply(learner);
  if (path === `/api/users/${tutor._id}`) return reply(tutor);
  if (path === `/api/users/${tutor._id}/reviews`) return reply([]);
  if (path === '/api/users/tutors') return reply([tutor]);
  if (path === '/api/credits/rules') return reply({ tutoringSessionCost: 20 });
  if (path === `/api/sessions/${sessionId}`) return reply(room);
  if (path === '/api/sessions' && body) { requestBody = body; writes.push(path); return reply({ _id: sessionId }); }
  if (path === '/api/sessions') return reply([room]);
  if (path === `/api/sessions/${sessionId}/reschedule/withdraw`) {
    writes.push({ path, body });
    if (body.proposalId !== room.rescheduleProposalId) return reply(null, 409, 'This proposal changed. Refresh.');
    room = { ...room, rescheduleHistory: [{ proposalId: body.proposalId, outcome: 'withdrawn' }],
      rescheduleProposalId: undefined, proposedScheduledAt: undefined, proposalStatus: null };
    return reply(room, 200, 'Proposal withdrawn. The original time remains.');
  }
  if (path === `/api/sessions/${sessionId}/reschedule`) {
    writes.push({ path, body });
    room = { ...room, rescheduleHistory: [{ proposalId: room.rescheduleProposalId, outcome: 'replaced' }],
      rescheduleProposalId: thirdId, proposedScheduledAt: body.scheduledAt, proposalStatus: 'active' };
    return reply(room, 200, 'Proposal replaced.');
  }
  if (path === `/api/sessions/${sessionId}/check-in`) {
    writes.push({ path, body }); room = { ...room, learnerCheckedInAt: new Date().toISOString(),
      rescheduleHistory: [{ proposalId: room.rescheduleProposalId, outcome: 'check_in_locked' }],
      rescheduleProposalId: undefined, proposedScheduledAt: undefined, proposalStatus: null };
    return reply(room, 200, 'Checked in. Waiting for your peer.');
  }
  if (options.method && options.method !== 'GET') throw new Error('Unexpected fixture mutation ' + path);
  if (path === '/api/notifications/unread-count') return reply({ count: 0 });
  if (path.startsWith('/api/notifications') || path.endsWith('/messages') || path.startsWith('/api/learning')) return reply([]);
  throw new Error('Unexpected fixture read ' + path);
};
const pause = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };
const until = async (condition, message) => { for (let index = 0; index < 100; index++) { if (condition()) return; await pause(); } throw new Error(message); };
const visible = (element) => Boolean(element?.getClientRects().length);
const button = (label) => [...document.querySelectorAll('button')].find((el) => visible(el) && el.textContent.trim() === label);
const fill = (selector, value) => {
  const el = document.querySelector(selector); assert(el, 'Missing field ' + selector);
  const prototype = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
};
const key = async (value) => { window.__acadovaKey = value; await until(() => !window.__acadovaKey, 'Native key ' + value); await pause(); };
const targetPath = (id = firstId) => `/sessions/${sessionId}?target=proposal&proposalId=${id}#session-proposal`;
let bridge;
export function Bridge() {
  const auth = useAuth(); const navigate = useNavigate(); const location = useLocation();
  useEffect(() => { bridge = { auth, navigate, location }; }, [auth, navigate, location]);
  return null;
}
localStorage.setItem('acadova_token', 'fixture');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge /><App /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
const go = async (path) => { bridge.navigate(path); await until(() => bridge.location.pathname === path.split(/[?#]/)[0], 'Navigation ' + path); await pause(240); };
const layout = () => {
  assert(document.documentElement.scrollWidth <= innerWidth + 1, 'Horizontal overflow');
  for (const el of [...document.querySelectorAll('.session-reschedule .btn')].filter(visible)) {
    assert(el.getBoundingClientRect().height >= 43.9, 'Proposal touch target too small');
  }
};
try {
  await until(() => bridge?.auth.isAuthenticated, 'Authenticated fixture');
  await until(() => bridge.location.pathname === '/', 'Initial route settled'); await pause(300);
  await go(`/tutors/${tutor._id}`); await until(() => document.querySelector('#subject option[value="Python"]'), 'Subject select');
  assert(document.getElementById('subject').tagName === 'SELECT', 'Tutor request is a teaching-subject selector');
  assert(document.getElementById('subject').getAttribute('aria-describedby').includes('subject-help'), 'Subject guidance association');
  const select = document.getElementById('subject'); select.value = 'Python'; select.dispatchEvent(new Event('change', { bubbles: true }));
  fill('#scheduledAt', '2099-10-15T12:00'); fill('#requestMessage', 'Help me learn Python.'); await pause();
  document.querySelector('#request-session form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => requestBody, 'Teaching-subject request'); assert(requestBody.subject === 'Python', 'Canonical selected subject submitted');
  await go('/tutors'); await until(() => button('Request Session'), 'Discovery request'); button('Request Session').click();
  await until(() => document.querySelector('[role="dialog"] #subject'), 'Discovery modal select');
  assert(document.getElementById('subject').tagName === 'SELECT', 'Discovery request also restricts teaching subjects');
  await key('Escape');
  tutor = { ...tutor, skillsToTeach: [] };
  await go(`/tutors/${tutor._id}`); await until(() => document.querySelector('#subject')?.disabled, 'Empty-skill guidance');
  assert(document.querySelector('#request-session [type="submit"]').disabled, 'No-skill request disabled');
  assert(document.getElementById('subject-help').textContent.includes('not listed'), 'No-skill explanation'); layout();
  tutor = { ...tutor, skillsToTeach: ['Java Arrays', 'Python'] };
  room = fresh(); const beforeReview = writes.length;
  await go(`/sessions/${sessionId}`); await until(() => button('Review proposed time'), 'Review alternative');
  const review = button('Review proposed time'); review.focus(); await key('Enter');
  await until(() => document.activeElement?.id === 'session-proposal', 'Exact proposal receives focus');
  assert(document.querySelector('.session-reschedule').open, 'Proposal disclosure opens');
  assert(document.querySelector('#room-panel-details').hidden === false, 'Details revealed');
  assert(bridge.location.search.includes(firstId), 'Review action targets exact proposal ID');
  assert(writes.length === beforeReview, 'Navigation does not mutate attendance/schedule');
  await pause(600);
  const box = document.getElementById('session-proposal').getBoundingClientRect();
  const header = [...document.querySelectorAll('.student-utility-bar, .student-mobile-header')].find(visible);
  assert(box.top >= (header?.getBoundingClientRect().bottom || 0) - 1, 'Focus target clears sticky header'); layout();
  assert(button('Accept new time'), 'Current peer proposal offers acceptance');
  // Stale link does not focus/highlight a replacement or mutate it.
  room = { ...fresh(), rescheduleProposalId: secondId, rescheduleHistory: [{ proposalId: firstId, outcome: 'replaced' }] };
  await go('/sessions'); await go(targetPath()); await until(() => document.querySelector('.session-proposal-notice'), 'Stale proposal explanation');
  assert(document.querySelector('.session-proposal-notice').textContent.includes('replaced'), 'Superseded link explained');
  assert(!document.querySelector('.session-proposal-emphasis'), 'Replacement never highlighted by stale link');
  assert(writes.length === beforeReview, 'Stale URL never mutates');
  room = { ...fresh(), proposalStatus: 'expired', proposedScheduledAt: new Date(Date.now() - 2 * 3600000).toISOString() };
  await go('/sessions'); await go(targetPath()); await until(() => document.querySelector('.session-proposal-notice')?.textContent.includes('expired'), '3 PM proposal at 5 PM is expired');
  assert(!button('Accept new time'), 'Expired page offers no acceptance');
  assert(button('Propose time'), 'Expired alternative permits recovery'); layout();
  room = { ...fresh(), rescheduleProposedBy: learner._id };
  await go('/sessions'); await go(targetPath()); await until(() => button('Withdraw proposal'), 'Own proposal recovery');
  assert(button('Replace proposal') && !button('Accept new time'), 'Proposer replaces/withdraws but cannot self-accept');
  fill('#reschedule-time', '2099-10-15T12:00'); await pause(); button('Replace proposal').click();
  await until(() => writes.at(-1)?.path?.endsWith('/reschedule'), 'Replacement submitted');
  assert(writes.at(-1).body.proposalId === firstId && room.rescheduleProposalId === thirdId, 'Replacement submits expected ID and gets a fresh ID');
  await until(() => document.querySelector('[data-proposal-id]')?.dataset.proposalId === thirdId && !button('Withdraw proposal')?.disabled, 'Replacement UI settled');
  button('Withdraw proposal').click(); await until(() => document.querySelector('[role="dialog"]'), 'Withdrawal confirmation');
  button('Cancel').click(); await until(() => !document.querySelector('[role="dialog"]'), 'Cancel withdrawal');
  assert(!writes.at(-1).path.endsWith('/withdraw'), 'Cancelled withdrawal makes no write');
  button('Withdraw proposal').click(); await until(() => document.querySelector('[role="dialog"]'), 'Withdrawal dialog');
  [...document.querySelectorAll('[role="dialog"] button')].find((el) => el.textContent === 'Withdraw proposal').click();
  await until(() => writes.at(-1)?.path?.endsWith('/withdraw'), 'Withdraw request');
  assert(writes.at(-1).body.proposalId === thirdId, 'Withdrawal binds expected latest ID');
  room = fresh(); await go('/sessions'); await go(`/sessions/${sessionId}`);
  await until(() => button('Check in'), 'Pending alternative allows original check-in'); button('Check in').click();
  await until(() => document.querySelector('[role="dialog"]'), 'Explicit check-in confirmation');
  button('I am present and ready').click();
  await until(() => room.learnerCheckedInAt, 'Explicit check-in call');
  assert(room.scheduledAt === scheduledAt && !room.rescheduleProposalId, 'Check-in retains original schedule and invalidates alternative');
  document.getElementById('room-tab-details').click(); await pause();
  assert(!button('Propose time') && document.body.textContent.includes('schedule is locked'), 'Attendance prevents rescheduling'); layout();
  // Router/login uses a same-origin allowlist and retains exact destination.
  bridge.auth.logout(); await until(() => !bridge.auth.isAuthenticated, 'Logout');
  await until(() => bridge.location.pathname === '/login', 'Logout redirect settled'); await pause(200);
  room = fresh(); bridge.navigate(targetPath()); await until(() => document.getElementById('login-email')
    && new URLSearchParams(bridge.location.search).get('returnTo') === targetPath(), 'Login return destination');
  assert(new URLSearchParams(bridge.location.search).get('returnTo') === targetPath(), 'Authorized internal destination preserved through Login');
  fill('#login-email', 'malformed'); fill('#login-password', 'fixture-password'); await pause();
  document.querySelector('.auth-form-column form, .auth-form-card form, form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => document.getElementById('login-email-error'), 'Existing Login validation retained'); assert(loginCalls === 0, 'Malformed Login sends no API');
  fill('#login-email', learner.email); await pause(); document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => bridge.location.pathname === `/sessions/${sessionId}` && document.activeElement?.id === 'session-proposal', 'Sign-in returns to exact proposal');
  assert(loginCalls === 1 && bridge.location.search.includes(firstId), 'Single sign-in returns with ID'); layout();
  if (window.__acadovaCaptureEnabled) { window.__acadovaCapture = 'proposal-focus'; await until(() => !window.__acadovaCapture, 'Screenshot capture'); }
  document.getElementById('result').textContent = 'PASS: subject selectors/empty skills; keyboard exact proposal focus, sticky header, stale/replaced/expired links; proposer replacement/withdrawal/cancel; original schedule check-in/attendance lock; allowlisted Login return and retained malformed-email validation; responsive no-overflow and touch targets';
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.message + '\n' + error.stack; }
