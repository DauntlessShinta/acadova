// Real Chrome/React/router; explicitly mocked HTTP. Never contacts live users.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import { getRoleNavigation } from '../src/config/roleNavigation';
import '../src/index.css';
const student = { _id: '507f1f77bcf86cd799439011', name: 'Student Fixture', email: 'student@example.test', role: 'student', emailVerified: true, credits: 100, skillsToTeach: ['Math'], skillsToLearn: ['Java'], onboardingFinishedAt: '2026-10-01' };
const peer = { ...student, _id: '507f1f77bcf86cd799439012', name: 'Taylor Fixture', skillsToTeach: ['Java'] };
const admin = { ...student, _id: '507f1f77bcf86cd799439013', name: 'Administrator Fixture', role: 'admin' };
const moderator = { ...student, _id: '507f1f77bcf86cd799439014', name: 'Moderator Fixture', role: 'moderator' };
const draft = { id: '507f1f77bcf86cd799439020', title: 'Unfinished arrays', subject: 'Java', description: '', questions: [], revision: 1, version: 1, state: 'private', isOwner: true };
const shared = { id: '507f1f77bcf86cd799439021', title: 'Shared arrays', subject: 'Java', authorName: peer.name, state: 'published' };
const session = { _id: '507f1f77bcf86cd799439030', subject: 'Java arrays', learner: student, tutor: peer, status: 'pending', creditAmount: 20, meetingMethod: 'online', scheduledAt: '2099-10-15T06:00:00Z' };
let actor = student; let writes = []; let fail = ''; let delayedSearch; let releaseSearch; let auditQuery;
const response = (data, status = 200, extras = {}) => new Response(JSON.stringify({ success: status < 400, data, ...extras }), { status });
window.fetch = async (url, options = {}) => {
  const parsed = new URL(String(url), location.origin); const path = parsed.pathname; const body = options.body ? JSON.parse(options.body) : null;
  if (body) writes.push({ path, body });
  if (fail && path === fail) return response(null, 503, { message: 'Fixture service unavailable. Retry.' });
  if (path === '/api/users/me') return response(actor);
  if (path === '/api/users/tutors') {
    const q = parsed.searchParams.get('subject') || '';
    if (q === delayedSearch) return new Promise(resolve => { releaseSearch = () => resolve(response([peer])); });
    return response(!q || 'java'.includes(q.toLowerCase()) ? [peer] : []);
  }
  if (path === `/api/users/${peer._id}`) return response(peer);
  if (path.endsWith('/reviews')) return response([]);
  if (path === '/api/credits/rules') return response({ tutoringSessionCost: 20, startingCreditGrant: 100, assessmentReward: 20 });
  if (path === '/api/sessions') return response(body ? session : []);
  if (path === '/api/admin/users') return response([student, peer, admin, moderator]);
  if (path === '/api/admin/sessions') return response([session]);
  if (path === '/api/admin/audit-logs') { auditQuery = parsed.searchParams; return response([], 200, { pagination: { page: 1, total: 0, limit: 25 } }); }
  if (path === '/api/study-sets') return response([draft]);
  if (path === '/api/study-sets/shared') { const q = parsed.searchParams.get('q') || ''; return response('shared arrays java'.includes(q.toLowerCase()) ? [shared] : []); }
  if (path === `/api/study-sets/${draft.id}`) return response(draft);
  if (path === '/api/learning/topics') return response([{ id: 'topic', name: 'Java arrays', description: 'Loops and collections', status: 'published' }]);
  if (path === '/api/notifications/unread-count') return response({ count: 0 });
  if (path.startsWith('/api/notifications') || path.startsWith('/api/moderator') || path.startsWith('/api/assessments') || path.startsWith('/api/learning') || path.startsWith('/api/credits')) return response([]);
  if (path.startsWith('/api/analytics') || path === '/api/admin/security') return response({});
  throw new Error('Unexpected fixture request: ' + path);
};
let bridge;
export function Bridge() { const auth = useAuth(); const navigate = useNavigate(); const location = useLocation(); useEffect(() => { bridge = { auth, navigate, location }; }, [auth, navigate, location]); return null; }
const pause = (ms = 60) => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };
const until = async (condition, message) => { for (let i = 0; i < 100; i++) { if (condition()) return; await pause(); } throw new Error(message); };
const visible = el => el && el.getClientRects().length;
const button = text => [...document.querySelectorAll('button')].find(el => visible(el) && el.textContent.trim() === text);
const link = text => [...document.querySelectorAll('a')].find(el => visible(el) && el.textContent.trim() === text);
const fill = (selector, value) => { const el = document.querySelector(selector); assert(el, 'Missing ' + selector); const prototype = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
const go = async path => { bridge.navigate(path); await until(() => bridge.location.pathname === path.split('?')[0], 'Navigate ' + path); await pause(160); };
const key = async value => { window.__acadovaKey = value; await until(() => !window.__acadovaKey, 'Native ' + value); await pause(); };
const layout = () => assert(document.documentElement.scrollWidth <= innerWidth + 1, 'Page horizontal overflow');
const capture = async name => { document.querySelectorAll('.app-toast button').forEach(el => el.click()); await pause(); if (window.__acadovaCaptureEnabled) { window.__acadovaCapture = name; await until(() => !window.__acadovaCapture, 'Capture ' + name); } };
const submit = selector => document.querySelector(selector).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
localStorage.setItem('acadova_token', 'milestone-fixture');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge /><App /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try {
  await until(() => bridge?.auth.isAuthenticated, 'Fixture authenticated');
  if (sessionStorage.getItem('milestone-refresh')) await until(() => document.title === 'Home | Acadova', 'Direct dashboard refresh title');
  await go('/dashboard'); await until(() => document.title === 'Home | Acadova', 'Dashboard browser title');
  if (!sessionStorage.getItem('milestone-refresh')) { sessionStorage.setItem('milestone-refresh', '1'); location.reload(); await new Promise(() => {}); }
  if (innerWidth > 1024) assert(document.querySelector('.utility-discovery-shortcut').textContent === 'Home', 'Dashboard shell title');
  assert([...document.querySelectorAll('a[aria-current="page"]')].some(el => el.textContent === 'Home'), 'Home active'); layout(); await capture('home');
  const searchButton = [...document.querySelectorAll('[aria-label="Search Acadova"]')].find(el => el.tagName === 'BUTTON' && visible(el)); searchButton.click();
  await until(() => document.querySelector('[role="dialog"] input'), 'Global search opens');
  fill('[role="dialog"] input', 'jAv'); await pause(); submit('[role="dialog"] form');
  await until(() => bridge.location.search.includes('jAv') && button('Request Session'), 'Global tutor search destination');
  assert(document.title === 'Find Tutors | Acadova', 'Tutor title');
  fill('#tutor-search', 'JA'); await pause(); submit('form[aria-label="Find tutors"]');
  await until(() => bridge.location.search.includes('JA') && button('Request Session'), 'Page search submission');
  // A delayed old result must not overwrite a newer search or its no-results state.
  delayedSearch = 'slow'; await go('/tutors?subject=slow'); await until(() => releaseSearch, 'Delayed query started');
  await go('/tutors?subject=missing'); await until(() => document.body.textContent.includes('No tutors match'), 'No results'); releaseSearch(); await pause(120);
  assert(document.body.textContent.includes('No tutors match'), 'Stale results ignored');
  button('View all tutors').click(); await until(() => button('Request Session'), 'Clear tutor search');
  fail = '/api/users/tutors'; await go('/tutors?subject=unavailable'); await until(() => button('Retry search'), 'Search failure retry');
  fail = ''; button('Retry search').click(); await until(() => document.body.textContent.includes('No tutors match'), 'Retry executes');
  await go('/tutors'); await until(() => button('Request Session'), 'Tutor available');
  window.scrollTo(0, document.body.scrollHeight); const trigger = button('Request Session'); trigger.focus(); trigger.click();
  await until(() => document.querySelector('[role="dialog"]'), 'Request modal'); await pause(250);
  const dialog = document.querySelector('[role="dialog"]'); const rect = dialog.getBoundingClientRect();
  assert(dialog.parentElement.parentElement === document.body, 'Modal mounted outside page layout');
  assert(rect.top >= 0 && rect.bottom <= innerHeight + 1, 'Modal within viewport after page scroll');
  assert(!document.getElementById('meetingMethod'), 'No method selector');
  assert(!document.getElementById('requestMessage').required, 'Message optional');
  assert(document.getElementById('requestMessage').maxLength === 500, 'Message limit');
  await capture('online-request');
  const close = dialog.querySelector('.modal-close'); close.focus(); await key('Shift+Tab'); assert(dialog.contains(document.activeElement), 'Focus wraps backwards'); await key('Tab'); assert(document.activeElement === close, 'Focus wraps forwards');
  await key('Escape'); assert(!document.querySelector('[role="dialog"]') && document.activeElement === trigger, 'Escape restores focus');
  trigger.click(); await until(() => document.getElementById('scheduledAt'), 'Reopen'); fill('#scheduledAt', '2099-10-15T14:00'); await pause(); submit('[role="dialog"] form');
  await until(() => document.querySelector('.session-request-success'), 'Blank request succeeds'); assert(writes.at(-1).body.requestMessage === '' && writes.at(-1).body.meetingMethod === 'online', 'Blank online payload'); await key('Escape');
  await go(`/tutors/${peer._id}`); await until(() => document.getElementById('requestMessage'), 'Profile request'); fill('#scheduledAt', '2099-10-16T14:00'); fill('#requestMessage', '   '); await pause(); submit('#request-session form');
  await until(() => document.querySelector('.session-request-success'), 'Whitespace profile request succeeds'); assert(writes.at(-1).body.requestMessage === '', 'Whitespace normalized');
  [...document.querySelectorAll('button[aria-label="Search Acadova"]')].find(visible).click();
  await until(() => document.querySelector('[role="dialog"] select'), 'Reopen global search');
  fill('[role="dialog"] select', 'learning'); fill('[role="dialog"] input', 'COLL'); await pause(); submit('[role="dialog"] form');
  await until(() => bridge.location.pathname === '/learning' && document.body.textContent.includes('Java arrays'), 'Global topic description matching');
  await go('/learning?q=unmatched'); await until(() => document.body.textContent.includes('No matching learning topics'), 'Topic no results'); button('Clear search').click(); await until(() => !bridge.location.search, 'Topic clear');
  await go('/study-sets'); await until(() => link('Open study set'), 'Private draft list'); link('Open study set').click(); await until(() => button('Submit for public review'), 'Private draft opens');
  const beforePublish = writes.length; button('Submit for public review').click(); await until(() => document.querySelector('.study-error-list'), 'Publication validation summary');
  assert(document.querySelector('.study-error-list').textContent.includes('at least one complete question'), 'Specific missing content shown');
  assert(!button('Retry loading') && writes.length === beforePublish, 'Validation does not suggest reloading or mutate');
  assert(document.activeElement.id === 'study-error', 'Validation summary focused'); await capture('draft-validation');
  link('Edit incomplete draft').click(); await until(() => document.getElementById('study-title'), 'Draft editor navigation');
  assert(document.getElementById('study-title').value === draft.title, 'Draft retained');
  await go('/study-sets?view=shared&q=ArRaY'); await until(() => link('Clear search'), 'Shared partial case query'); assert(document.body.textContent.includes(shared.title), 'Shared result');
  fill('#study-search', 'missing'); await pause(); submit('form:has(#study-search)'); await until(() => document.body.textContent.includes('No approved sets found'), 'Shared search submission / no results');
  history.back(); await until(() => document.getElementById('study-search')?.value === 'ArRaY', 'Back syncs search input');
  history.forward(); await until(() => document.getElementById('study-search')?.value === 'missing', 'Forward syncs search input');
  link('Clear search').click(); await until(() => document.getElementById('study-search')?.value === '', 'Shared clear sync');
  fail = '/api/study-sets/shared'; await go('/study-sets?view=shared&q=fail'); await until(() => button('Retry loading'), 'Study failure'); assert(!document.querySelector('.study-card'), 'No stale cards on error'); fail = ''; button('Retry loading').click(); await until(() => !button('Retry loading'), 'Study retry');
  await go('/'); actor = admin; await bridge.auth.refreshUser(); await go('/admin/users'); await until(() => document.querySelector('.admin-user-table'), 'Admin users');
  fill('input[type="search"]', 'TAyL'); await pause(); assert(document.querySelectorAll('tbody tr').length === 1, 'User partial case search');
  fill('.staff-filter-select select', 'moderator'); await pause(); assert(document.body.textContent.includes('No users match'), 'User combined filter');
  fill('input[type="search"]', ''); await pause(); assert(document.querySelectorAll('tbody tr').length === 1, 'User clear retains role');
  fill('.staff-filter-select select', 'all'); await pause(); layout(); await capture('admin-users');
  for (const badge of document.querySelectorAll('.admin-user-table .badge')) assert(getComputedStyle(badge).whiteSpace === 'nowrap', 'Role badge stays on one line');
  await go('/admin/sessions'); await until(() => document.querySelector('input[type="search"]'), 'Admin sessions'); fill('input[type="search"]', 'aRRa'); await pause(); assert(document.querySelectorAll('tbody tr').length === 1, 'Session partial case search');
  fill('.staff-filter-select select', 'completed'); await pause(); assert(document.body.textContent.includes('No sessions match'), 'Session combined status');
  fill('input[type="search"]', ''); fill('.staff-filter-select select', 'all'); await pause(); assert(document.querySelectorAll('tbody tr').length === 1, 'Session clear');
  await go('/admin/audit-logs'); await until(() => document.getElementById('audit-actor'), 'Audit input'); fill('#audit-actor', 'bad'); await pause(); button('Apply actor').click(); await until(() => document.querySelector('#audit-actor[aria-invalid="true"]'), 'Actor ID validation');
  fill('#audit-actor', student._id); await pause(); button('Apply actor').click(); await until(() => auditQuery?.get('actor') === student._id, 'Actor exact filter');
  fill('#audit-actor', ''); await pause(); button('Apply actor').click(); await until(() => !auditQuery?.has('actor'), 'Actor clear');
  // Title checks for staff routes exercise the actual router. Data views remain fixture-only.
  for (const role of ['admin', 'moderator']) {
    if (role === 'moderator') { await go('/'); actor = moderator; await bridge.auth.refreshUser(); }
    for (const { to, label } of getRoleNavigation(role)) {
      // Dashboard/analytics payload shape is covered by the existing hardening fixture.
      if (['/admin', '/admin/analytics', '/admin/security', '/moderator'].includes(to)) continue;
      await go(to); assert(document.querySelector('.staff-topbar small')?.textContent === label, 'Staff header ' + to);
      assert(document.title.startsWith(label + ' | '), 'Staff document title ' + to); layout();
    }
  }
  await go('/moderator/reviews'); await capture('moderator-reviews');
  document.getElementById('result').textContent = 'PASS: Phase A route titles/history, global/tutor/topic/shared/user/session/actor search, stale/failure states, optional online requests, scrolled modal bounds/native focus/Escape, private draft validation/editing, role navigation and responsive layout. HTTP mocked.';
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.stack; }
