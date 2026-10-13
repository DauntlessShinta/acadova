// Real browser/components; synthetic mocked HTTP only, no live API or users.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import { recentRange } from '../src/utils/analyticsPresentation';
import '../src/index.css';
const student = { _id: '507f1f77bcf86cd799439011', name: 'Student Fixture', email: 'student@example.test', role: 'student', credits: 100, emailVerified: true, skillsToTeach: ['Math'], onboardingFinishedAt: '2026-10-01' };
const admin = { ...student, _id: '507f1f77bcf86cd799439012', name: 'Admin Fixture', role: 'admin' };
const moderator = { ...student, _id: '507f1f77bcf86cd799439013', name: 'Moderator Fixture', role: 'moderator' };
const peer = { ...student, _id: '507f1f77bcf86cd799439014', name: 'Taylor Fixture', skillsToTeach: ['Java', 'Python'] };
const pending = { id: '507f1f77bcf86cd799439020', title: 'Arrays pending', subject: 'Java', authorId: student._id, authorName: student.name, state: 'pending', revision: 1, version: 2, questions: [{ prompt: 'First index?', options: ['Zero', 'One'], correctIndex: 0 }], reports: [], submittedAt: '2026-10-01', description: '' };
const reported = { ...pending, id: '507f1f77bcf86cd799439021', title: 'Functions reported', state: 'published', reports: [{ id: '507f1f77bcf86cd799439022', reporterName: 'Reporter Fixture', reason: 'Synthetic confusing wording.', cycle: 1, revision: 1, createdAt: '2026-10-02' }] };
let actor = admin; let failure = ''; let delayedFrom = ''; let releaseDelayed;
const queries = []; const writes = []; let auditCategory;
const captureView = new URLSearchParams(location.search).get('capture');
const response = (data, status = 200, extras = {}) => new Response(JSON.stringify({ success: status < 400, data, ...extras }), { status });
const learning = { officialAttempts: 4, officialPassed: 3, officialPassRate: 75, practiceAttempts: 2, studyAttempts: 3, resourceUnlocks: 2, moduleUnlocks: 1, unlocks: 3 };
window.fetch = async (url, options = {}) => {
  const parsed = new URL(String(url), location.origin); const path = parsed.pathname;
  if (options.body) writes.push({ path, body: JSON.parse(options.body) });
  if (path === '/api/auth/login') return response({ token: 'phaseb-fixture-' + actor.role, user: actor });
  if (path === '/api/users/me') return response(actor);
  if (path === '/api/admin/trust-summary') return response({ protectionEvents: 0, roleChanges: 0, adminActions: 0, activeCooldowns: 0 });
  if (path === '/api/moderator/overview') return response({ ...recentRange(Number(parsed.searchParams.get('days') || 7)), counts: { pendingReviews: 1, reportedContent: 1, sessionDisputes: 0, decisionsToday: 0 }, queue: [{ id: pending.id, type: 'study', title: pending.title, detail: 'Pending publication', date: pending.submittedAt, href: '/moderator/study-sets?set=' + pending.id }], recent: [], trend: { decisions: [], reports: [] } });
  if (path === '/api/admin/overview') return response({ total: 5, students: 3, moderators: 1, suspended: 1, unverified: 1 });
  if (path === '/api/admin/operations') return response({ byStatus: { scheduled: 2 }, pendingResources: 0, pendingStudySets: 1, openStudyReports: 1, recentCredits: [] });
  if (path === '/api/admin/users') return response([student, peer, admin, moderator, { ...student, _id: '507f1f77bcf86cd799439019', name: 'Suspended Fixture', emailVerified: false, suspendedAt: '2026-10-01' }].filter(row => (!parsed.searchParams.get('role') || row.role === parsed.searchParams.get('role')) && (parsed.searchParams.get('status') !== 'suspended' || row.suspendedAt)));
  if (path === '/api/admin/sessions') return response([]);
  if (path === '/api/admin/audit-logs') { auditCategory = parsed.searchParams.get('category'); return response([], 200, { pagination: { page: 1, limit: 25, total: 0 } }); }
  if (path === '/api/admin/security') return response({ counts: { cooldownStarted: 0, cooldownExtended: 0, activeCooldowns: 0, recoveredLogins: 0, suspendedAttempts: 0 }, events: [] });
  if (path === '/api/admin/credits/rules' || path === '/api/credits/rules') return response({ tutoringSessionCost: 20, startingCreditGrant: 100, assessmentReward: 20, version: 1 });
  if (path === '/api/admin/credits/activity') return response([{ _id: 'payment', type: 'session_payment', amount: 20, createdAt: '2026-10-01', fromUser: student._id, toUser: peer._id }, { _id: 'reward', type: 'assessment_reward', amount: 20, createdAt: '2026-10-02', toUser: student._id }]);
  if (path === '/api/users/tutors') return response([peer]);
  if (path === '/api/sessions' || path.startsWith('/api/ratings')) return response([]);
  if (path === '/api/credits/mine') return response([], 200, { balance: 100, summary: { recordedEarned: 0, recordedSpent: 0 } });
  if (path === `/api/users/${peer._id}`) return response(peer);
  if (path.endsWith('/reviews')) return response([]);
  if (path.startsWith('/api/analytics/')) {
    const from = parsed.searchParams.get('from'); const to = parsed.searchParams.get('to'); queries.push({ path, from, to });
    if (failure === path) return response(null, 503, { message: 'Fixture analytics unavailable.' });
    const count = from === recentRange(7).from ? 4 : 12;
    const data = path.endsWith('/subjects') ? [{ subject: 'Java', requestCount: count }]
      : path.endsWith('/sessions') ? { total: count, byStatus: { scheduled: 2, awaiting_validation: 1 }, trend: from ? [{ _id: to, count }] : [] }
        : path.endsWith('/credits') ? { totalTransactions: 5, tutoringPayments: 2, breakdown: { sessionTransferred: 40, assessmentAwarded: 20, initialGranted: 100, learningSpent: 25, adminAdded: 0, adminRemoved: 0 }, trend: from ? [{ _id: to, count: 2 }] : [] }
          : path.endsWith('/learning') ? learning : { averageRating: 4, totalRatings: 1, distribution: [{ _id: 4, count: 1 }] };
    if (path.endsWith('/sessions') && from === delayedFrom) return new Promise(resolve => { releaseDelayed = () => resolve(response(data)); });
    return response(data);
  }
  if (path === '/api/moderator/study-sets') return response([pending, reported]);
  if (path.startsWith('/api/moderator/study-sets/')) return response(path.endsWith(pending.id) ? pending : reported);
  if (path === '/api/notifications/unread-count') return response({ count: 0 });
  if (path.startsWith('/api/notifications') || path.startsWith('/api/moderator') || path.startsWith('/api/learning') || path.startsWith('/api/assessments')) return response([]);
  throw new Error('Unexpected fixture request: ' + path);
};
let bridge;
export function Bridge() { const auth = useAuth(); const navigate = useNavigate(); const location = useLocation(); useEffect(() => { bridge = { auth, navigate, location }; }, [auth, navigate, location]); return null; }
const pause = (ms = 60) => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };
const until = async (condition, message) => { for (let i = 0; i < 100; i++) { if (condition()) return; await pause(); } throw new Error(message); };
const visible = element => element && element.getClientRects().length;
const button = text => [...document.querySelectorAll('button')].find(element => visible(element) && element.textContent.trim() === text);
const fill = (selector, value) => { const element = document.querySelector(selector); assert(element, 'Missing ' + selector); const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); };
const go = async path => { bridge.navigate(path); await until(() => bridge.location.pathname === (path.startsWith('/admin/audit-logs') || path.startsWith('/admin/security') ? '/admin/trust-activity' : path.split('?')[0]), 'Navigate ' + path); await pause(120); };
const layout = () => assert(document.documentElement.scrollWidth <= innerWidth + 1, 'No horizontal page overflow');
const metric = label => [...document.querySelectorAll('.metric-panel')].find(element => element.textContent.includes(label))?.querySelector('strong')?.textContent;
localStorage.setItem('acadova_token', 'phaseb-fixture');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge /><App /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try {
  await until(() => bridge?.auth.isAuthenticated, 'Fixture authenticated');
  await go('/admin'); await until(() => document.querySelector('.stat-grid')?.textContent.includes('5'), 'Database overview displayed'); layout();
  await go('/admin/analytics'); await until(() => metric('Session requests') === '12', 'Initial analytics loaded');
  assert(document.querySelectorAll('.metric-panel').length === 5, 'Five KPIs');
  assert(document.querySelector('.analytics-trend') && document.querySelectorAll('.analytics-comparison').length === 2, 'Three new charts rendered');
  assert(metric('Official assessment pass rate') === '75%', 'Pass rate displayed'); layout();
  button('Last 7 days').focus(); window.__acadovaKey = 'Enter'; await until(() => !window.__acadovaKey, 'Native keyboard activates period');
  await until(() => metric('Session requests') === '4', 'Period changes data, not just labels');
  assert(queries.slice(-5).every(query => query.from === recentRange(7).from), 'All sources use the same period');
  document.querySelector('.analytics-data-table summary').click(); assert(document.querySelectorAll('.analytics-data-table tbody tr').length === 7, 'Accessible exact daily values');
  delayedFrom = recentRange(90).from; button('Last 90 days').click(); await until(() => releaseDelayed, 'Delayed analytics captured');
  button('Last 7 days').click(); releaseDelayed(); await until(() => metric('Session requests') === '4', 'Latest period displayed'); await pause(160); assert(metric('Session requests') === '4', 'Stale response cannot replace latest period'); delayedFrom = '';
  failure = '/api/analytics/learning'; button('Last 30 days').click(); await until(() => button('Retry unavailable analytics'), 'Partial analytics failure is visible');
  assert(metric('Official assessment pass rate') === 'Unavailable', 'Unavailable is never reported as zero'); failure = ''; button('Retry unavailable analytics').click(); await until(() => metric('Official assessment pass rate') === '75%', 'Partial source retry succeeds');
  document.querySelector('.analytics-custom-range summary').click(); fill('.analytics-filter input[type=date]', '2024-01-01'); await pause(); const before = queries.length; button('Apply period').click(); await until(() => document.querySelector('.analytics-filter .form-error').textContent.includes('366'), 'Oversized period validated'); assert(queries.length === before, 'Invalid period does not query');
  await go('/admin/users'); await until(() => document.querySelectorAll('tbody tr').length === 5, 'User directory loaded');
  const accountSelect = [...document.querySelectorAll('select')].find(element => [...element.options].some(option => option.text === 'Suspended'));
  fill('select', 'all'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(accountSelect, 'suspended'); accountSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await until(() => document.querySelectorAll('tbody tr').length === 1, 'Suspended filter changes actual rows'); assert(document.querySelector('tbody').textContent.includes('Suspended Fixture'), 'Correct account retained'); layout();
  await go('/admin/credits'); await until(() => document.querySelector('.status-list')?.children.length === 2, 'Credit events loaded');
  fill('select', ''); // Existing target placeholder cannot become a valid Student.
  const eventSelect = [...document.querySelectorAll('select')].find(element => [...element.options].some(option => option.value === 'assessment_reward'));
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(eventSelect, 'assessment_reward'); eventSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await until(() => document.querySelector('.status-list')?.children.length === 1, 'Credit event filter works'); assert(writes.length === 0, 'Read-only workflow changes no credits'); layout();
  await go('/admin/audit-logs'); await until(() => button('Clear filters'), 'Audit filters loaded'); fill('select', 'study'); await until(() => auditCategory === 'study', 'Audit category is sent to backend');
  assert([...document.querySelectorAll('option')].some(option => option.text.includes('publication decided')), 'Category options remain available');
  actor = moderator; await bridge.auth.login('moderator@example.test', 'SyntheticFixture1!'); await until(() => bridge.auth.user?.role === 'moderator' && bridge.location.pathname === '/moderator', 'Moderator role redirect settled'); await go('/moderator');
  await until(() => document.querySelector('.staff-queue-list')?.textContent.includes(pending.title), 'Study Set queue appears in Moderator overview');
  const studyLink = [...document.querySelectorAll('.staff-queue-list a')].find(element => element.getAttribute('href').includes(pending.id)); assert(studyLink, 'Case-specific link'); studyLink.click(); await until(() => document.getElementById('study-case-' + pending.id), 'Deep link opens case');
  await go('/moderator/study-sets'); await until(() => document.querySelectorAll('.study-card').length === 2, 'Study reviews loaded');
  fill('select', 'reports'); await until(() => document.querySelectorAll('.study-card').length === 1, 'Open-report filter'); assert(document.querySelector('.study-card h2').textContent === reported.title, 'Published reported case remains'); layout();
  actor = student; await bridge.auth.login('student@example.test', 'SyntheticFixture1!'); await until(() => bridge.auth.user?.role === 'student' && bridge.location.pathname === '/dashboard', 'Student role redirect settled'); await go('/tutors'); await until(() => button('Request Session'), 'Tutor discovery available'); button('Request Session').click(); await until(() => document.querySelector('[role=dialog] #subject'), 'Request modal');
  const placeholder = document.querySelector('[role=dialog] #subject option[value=""]'); assert(placeholder.disabled && placeholder.hidden, 'Teaching placeholder disabled and hidden');
  assert([...document.querySelector('[role=dialog] #subject').options].slice(1).every(option => peer.skillsToTeach.includes(option.value)), 'Only actual teaching subjects selectable');
  document.querySelector('[role=dialog] button[aria-label="Close modal"]').click(); await go('/tutors/' + peer._id); await until(() => document.getElementById('subject'), 'Tutor profile request'); assert(document.querySelector('#subject option[value=""]').disabled, 'Profile placeholder matches'); layout();
  actor = admin; await bridge.auth.login('admin@example.test', 'SyntheticFixture1!'); await until(() => bridge.auth.user?.role === 'admin' && bridge.location.pathname === '/admin', 'Admin role redirect settled'); await go('/admin/analytics'); await until(() => metric('Session requests') === '12', 'Final analytics layout'); layout();
  if (captureView === '/analytics-charts') { document.querySelector('.analytics-trend').closest('section').scrollIntoView(); await pause(); }
  document.getElementById('result').textContent = `PASS: Phase B analytics periods, charts, stale/partial responses, role views, account/credit/audit filters, Study Set queue and subject placeholders (${innerWidth}px). Mocked HTTP; no production verification.`;
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.message; }
