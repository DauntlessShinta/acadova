// Real Chrome/React/router/UI, with an in-memory backend and blocked external navigation.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import '../src/index.css';
const learner = { _id: '507f1f77bcf86cd799439011', name: 'Learner Fixture', email: 'learner@example.test', role: 'student', emailVerified: true,
  credits: 100, skillsToTeach: ['Math'], skillsToLearn: ['Java'], onboardingFinishedAt: '2026-10-01' };
const tutor = { ...learner, _id: '507f1f77bcf86cd799439012', name: 'Tutor Fixture' };
const staff = { ...learner, _id: '507f1f77bcf86cd799439014', name: 'Moderator Fixture', role: 'moderator' };
const sid = '507f1f77bcf86cd799439013';
let actor = learner; let writes = []; let evidenceFails = false; let blockedSettlement = true; let joined = 0;
const scheduledAt = new Date(Date.now() + 5 * 60000).toISOString();
let room = { _id: sid, learner, tutor, subject: 'Completion fixture', status: 'scheduled', scheduledAt, creditAmount: 20,
  meetingMethod: 'online', meetingLink: 'https://example.test/meeting', reviewVersion: 0 };
const response = (data, status = 200, message = '') => new Response(JSON.stringify({ success: status < 400, data, message }), { status });
const present = () => ({ ...room, completionReview: { state: room.status === 'resolved' ? 'resolved' : room.reviewReferral ? 'referred' : room.validationDeadlineAt && new Date(room.validationDeadlineAt) <= new Date() ? 'overdue' : 'pending',
  canTutorRequestReview: room.status === 'awaiting_validation' && !room.reviewReferral && Boolean(room.validationDeadlineAt && new Date(room.validationDeadlineAt) <= new Date()) } });
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  const body = options.body ? JSON.parse(options.body) : null;
  if (path === '/api/users/me') return response(actor);
  if (path === `/api/sessions/${sid}`) return response(present());
  if (path === '/api/sessions') return response([present()]);
  if (path === `/api/sessions/${sid}/check-in`) { writes.push({ path, body }); room.learnerCheckedInAt = new Date().toISOString(); return response(present(), 200, 'Checked in.'); }
  if (path === `/api/sessions/${sid}/finish`) {
    writes.push({ path, body }); room = { ...room, status: 'awaiting_validation', awaitingValidationAt: new Date().toISOString(),
      validationDeadlineAt: new Date(Date.now() + 72 * 3600000).toISOString(), reviewVersion: room.reviewVersion + 1 };
    return response(present(), 200, 'Session finished. Both participants must confirm.');
  }
  if (path === `/api/sessions/${sid}/evidence` && body) {
    writes.push({ path, body }); if (evidenceFails) return response(null, 503, 'Evidence service unavailable. Retry with your retained draft.');
    room = { ...room, reviewVersion: room.reviewVersion + 1, completionEvidence: [...(room.completionEvidence || []), { ...body, id: 'evidence-' + writes.length, submittedBy: actor._id, submittedAt: new Date().toISOString() }] };
    return response(present(), 200, 'Private evidence saved.');
  }
  if (path === `/api/sessions/${sid}/review-request`) {
    writes.push({ path, body }); room = { ...room, reviewVersion: room.reviewVersion + 1,
      reviewReferral: { id: 'case', source: 'tutor_request', reason: body.reason, createdAt: new Date().toISOString(), targetAt: new Date(Date.now() + 48 * 3600000).toISOString() } };
    return response(present(), 200, 'Completion review requested.');
  }
  if (path === '/api/moderator/sessions/disputed') return response(room.status === 'resolved' ? [] : [present()]);
  if (path === '/api/moderator/sessions/resolved') return response(room.status === 'resolved' ? [present()] : []);
  if (path === `/api/moderator/sessions/${sid}/evidence`) return response({ session: present(), messages: [{ _id: 'message', sender: learner, body: 'We completed array exercises.', createdAt: new Date().toISOString() }], payments: [] });
  if (path === `/api/moderator/sessions/${sid}/clarify`) {
    writes.push({ path, body }); room = { ...room, reviewVersion: room.reviewVersion + 1, reviewClarifications: [{ id: 'clarification', requestedBy: staff._id, requestedAt: new Date().toISOString(), reason: body.reason }] };
    return response(present(), 200, 'Clarification requested.');
  }
  if (path === `/api/moderator/sessions/${sid}/resolve`) {
    writes.push({ path, body }); if (blockedSettlement && body.resolution === 'confirm_session') return response(null, 400, 'The Learner has insufficient credits. This case remains open.');
    room = { ...room, status: 'resolved', resolution: body.resolution, resolutionNote: body.resolutionNote, resolvedAt: new Date().toISOString(), reviewReferral: { ...room.reviewReferral, closedAt: new Date().toISOString(), closure: 'staff_resolution' } };
    return response(present(), 200, 'Review resolved.');
  }
  if (options.method && options.method !== 'GET') throw new Error('Unexpected fixture mutation ' + path);
  if (path === '/api/notifications/unread-count') return response({ count: 0 });
  if (path.startsWith('/api/notifications') || path.endsWith('/messages') || path.startsWith('/api/learning') || path.startsWith('/api/moderator/ratings')) return response([]);
  if (path === '/api/credits/rules') return response({ tutoringSessionCost: 20 });
  throw new Error('Unexpected fixture read ' + path);
};
// Native anchor activation is inspected; the fixture blocks the external request.
document.addEventListener('click', (event) => { if (event.target.closest?.('a[href="https://example.test/meeting"]')) { joined++; event.preventDefault(); } });
let bridge;
export function Bridge() { const auth = useAuth(); const navigate = useNavigate(); const location = useLocation(); useEffect(() => { bridge = { auth, navigate, location }; }, [auth, navigate, location]); return null; }
const pause = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };
const until = async (condition, message) => { for (let index = 0; index < 100; index++) { if (condition()) return; await pause(); } throw new Error(message); };
const visible = (el) => el?.getClientRects().length;
const button = (text) => [...document.querySelectorAll('button')].find((el) => visible(el) && el.textContent.trim() === text);
const fill = (selector, value) => { const el = document.querySelector(selector); assert(el, 'Missing ' + selector); Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
const key = async (value) => { window.__acadovaKey = value; await until(() => !window.__acadovaKey, 'Native key ' + value); await pause(); };
const go = async (path) => { bridge.navigate(path); await until(() => bridge.location.pathname === path.split(/[?#]/)[0], 'Route ' + path); await pause(250); };
const switchActor = async (next) => { actor = next; await bridge.auth.refreshUser(); await until(() => bridge.auth.user?._id === next._id, 'Actor switch'); };
const layout = () => assert(document.documentElement.scrollWidth <= innerWidth + 1, 'Horizontal overflow');
const capture = async (name) => {
  document.querySelectorAll('.app-toast button').forEach((el) => el.click());
  const target = name.startsWith('staff') ? document.querySelector('.session-private-evidence') : document.getElementById('session-completion');
  target?.scrollIntoView({ block: 'start', behavior: 'instant' }); await pause(100);
  if (window.__acadovaCaptureEnabled) { window.__acadovaCapture = name; await until(() => !window.__acadovaCapture, 'Capture ' + name); }
};
localStorage.setItem('acadova_token', 'fixture');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge /><App /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try {
  await until(() => bridge?.auth.isAuthenticated && bridge.location.pathname === '/', 'Initial route'); await pause(200);
  await go(`/sessions/${sid}`); await until(() => button('Check in'), 'Check-in available');
  const join = document.querySelector('a[href="https://example.test/meeting"]');
  assert(join.target === '_blank' && join.rel.includes('noopener') && join.rel.includes('noreferrer'), 'Synchronous native external link protections');
  join.click(); await pause(); assert(joined === 1 && writes.length === 0 && !room.learnerCheckedInAt && actor.credits === 100, 'Opening meeting records no attendance or credits');
  button('Check in').focus(); await key('Enter'); await until(() => document.querySelector('[role="dialog"]'), 'Check-in confirmation dialog');
  assert(document.querySelector('[role="dialog"]').textContent.includes('self-reported'), 'Attendance provenance explained');
  await key('Escape'); assert(writes.length === 0 && !room.learnerCheckedInAt, 'Cancelled check-in makes no mutation');
  assert(document.activeElement === button('Check in'), 'Cancel restores check-in focus');
  button('Check in').click(); await until(() => button('I am present and ready'), 'Presence confirmation'); button('I am present and ready').click();
  await until(() => room.learnerCheckedInAt && !document.querySelector('[role="dialog"]'), 'Explicit check-in submitted');
  assert(writes.at(-1).body.expectedScheduledAt === scheduledAt, 'Consent binds the displayed confirmed schedule');
  room = { ...room, status: 'in_progress', tutorCheckedInAt: new Date().toISOString(), startedAt: new Date().toISOString() };
  await switchActor(tutor); await go('/sessions'); await go(`/sessions/${sid}`); await until(() => button('Finish live session'), 'Tutor finish');
  const beforeFinish = writes.length; button('Finish live session').click(); await until(() => document.querySelector('[role="dialog"]'), 'Finish confirmation'); button('Cancel').click(); await pause(); assert(writes.length === beforeFinish, 'Cancelled finish does not mutate');
  button('Finish live session').click(); await until(() => document.querySelector('[role="dialog"]'), 'Tutor finish dialog'); button('Finish Session').click();
  await until(() => room.status === 'awaiting_validation' && document.getElementById('evidence-summary'), 'Completion pending UI');
  await until(() => document.body.textContent.includes('Response deadline:') && document.body.textContent.includes('second positive confirmation'), 'Finished response rendered');
  assert(!room.tutorConfirmedAt && !room.creditsSettledAt, 'Finish is not consent or payment');
  assert(document.body.textContent.includes('Response deadline:') && document.body.textContent.includes('second positive confirmation'), 'Deadline and separate confirmation explained'); layout();
  fill('#evidence-summary', 'short'); fill('#evidence-completedWork', 'Completed practice exercises.'); await pause(); button('Save private evidence').click();
  await until(() => document.getElementById('evidence-error-summary'), 'Inline evidence validation'); assert(document.activeElement.id === 'evidence-summary', 'Evidence validation focus');
  fill('#evidence-summary', '<script>Only plain text</script>'); fill('#evidence-links', 'http://example.test/work'); await pause(); button('Save private evidence').click();
  await until(() => document.getElementById('evidence-error-links'), 'Invalid evidence URL rejected');
  fill('#evidence-links', 'https://example.test/work'); evidenceFails = true; await pause(); button('Save private evidence').click();
  await until(() => document.querySelector('.session-completion-panel [role="alert"]')?.textContent.includes('unavailable'), 'Persistent failure feedback');
  assert(document.getElementById('evidence-summary').value.includes('<script>'), 'Failed evidence retains draft');
  evidenceFails = false; button('Save private evidence').click(); await until(() => room.completionEvidence?.length && document.getElementById('evidence-summary').value === '', 'Evidence saved');
  assert(!document.querySelector('.session-evidence-entry script') && document.querySelector('.session-evidence-entry').textContent.includes('<script>'), 'Evidence safely rendered as plain text');
  const evidenceLink = document.querySelector('.session-evidence-entry a'); assert(evidenceLink.rel.includes('noopener') && evidenceLink.href === 'https://example.test/work', 'Private evidence link safe');
  room = { ...room, validationDeadlineAt: new Date(Date.now() - 1000).toISOString() };
  await go('/sessions'); await go(`/sessions/${sid}#session-completion`); await until(() => button('Request completion review'), 'Overdue Tutor review action');
  assert(document.body.textContent.includes('Silence does not approve'), 'Overdue does not imply payment');
  fill('#completion-review-reason', 'My peer has not responded; please review the completed work.'); await pause(); button('Request completion review').click();
  await until(() => room.reviewReferral && !button('Request completion review'), 'Referral is one pending case');
  assert(document.body.textContent.includes('Staff review pending') && !room.disputedBy && !room.creditsSettledAt, 'Honest referral, no fake dispute/payment'); await capture('participant-referred'); layout();
  room = { ...room, reviewReferral: { ...room.reviewReferral, source: 'system_overdue' } };
  await switchActor(staff); await go(`/moderator/disputes?session=${sid}`); await until(() => button('View messages and ledger'), 'Staff review queue');
  assert(document.body.textContent.includes('System overdue referral; no participant dispute') && !document.body.textContent.includes('Disputed by:'), 'Staff UI does not fabricate disputing actor');
  button('View messages and ledger').click(); await until(() => document.body.textContent.includes('We completed array exercises.'), 'Private messages loaded');
  assert(document.body.textContent.includes('No Session credit transaction.'), 'Ledger evidence shown');
  fill(`#resolution-note-${sid}`, 'Please explain which exercises were completed.'); await pause(); button('Request clarification').click();
  await until(() => document.querySelector('[role="dialog"]'), 'Staff clarification confirmation');
  [...document.querySelectorAll('[role="dialog"] button')].find((el) => el.textContent === 'Request clarification').click();
  await until(() => room.reviewClarifications?.length && !document.querySelector('[role="dialog"]'), 'Clarification saved');
  assert(writes.at(-1).body.reviewVersion != null && room.status === 'awaiting_validation', 'Clarification binds reviewed version without settlement');
  fill(`#resolution-note-${sid}`, 'Reviewed all available completion evidence.'); await pause();
  button('Confirm session and settle credits').click(); await until(() => button('Resolve completion review'), 'Approval confirmation'); button('Resolve completion review').click();
  await until(() => document.body.textContent.includes('Learner has insufficient credits'), 'Blocked settlement actionable error');
  assert(room.status === 'awaiting_validation' && !room.creditsSettledAt, 'Blocked case remains open');
  await capture('staff-review-evidence'); layout();
  button('Mark session invalid').click(); await until(() => button('Resolve completion review'), 'Rejection confirmation'); button('Resolve completion review').click();
  await until(() => room.status === 'resolved' && !button('Mark session invalid'), 'Rejected case removed from open queue');
  assert(room.resolution === 'cancel_session' && !room.creditsSettledAt && writes.at(-1).body.reviewVersion != null, 'Versioned rejection transfers no credits');
  await go('/moderator/disputes'); await go(`/moderator/disputes?session=${sid}`);
  await until(() => document.body.textContent.includes('This review is already closed'), 'Closed referral notification remains explainable');
  assert(!button('Confirm session and settle credits'), 'Closed referral link never offers another settlement');
  await switchActor(learner); await go(`/sessions/${sid}#session-completion`); await until(() => document.body.textContent.includes('Staff did not validate completion'), 'Participant sees resolved reason');
  assert(document.body.textContent.includes('Review closed:') && !document.body.textContent.includes('Confirm honestly or dispute the session.') && !document.body.textContent.includes('Staff response target:'), 'Closed review offers no stale confirmation or pending staff instruction');
  assert(document.body.textContent.includes('Reviewed all available completion evidence.') && !button('Save private evidence'), 'Resolved state preserves reason and prevents new evidence'); layout();
  document.getElementById('result').textContent = 'PASS: Join has no attendance/payment; keyboard Cancel/explicit presence and schedule binding; Tutor Finish vs completion consent; deadlines/overdue/referral; bounded private text/HTTPS evidence, validation focus and failed-draft retry; honest staff queue, messages/ledger, clarification, blocked settlement and versioned rejection; resolved participant state and no overflow';
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.message + '\n' + error.stack; }
