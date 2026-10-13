// Real components and Chrome; synthetic HTTP only, no live provider/database.
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
const peer = { ...student, _id: '507f1f77bcf86cd799439014', name: 'Elizabeth Olson', skillsToTeach: ['Java', 'Python'] };
const question = { prompt: 'Which index selects the first item?', options: ['Zero', 'One'], correctIndex: 0, explanation: 'Indices start at zero.' };
const study = { id: '507f1f77bcf86cd799439020', title: 'Java arrays practice', subject: 'Java', state: 'private', isOwner: true, revision: 1, version: 1, questions: [question], description: 'Synthetic study practice', reports: [], authorId: student._id, authorName: student.name };
let attempt = { id: '507f1f77bcf86cd799439021', studySetId: study.id, title: study.title, revision: 1, access: 'owner', questions: [question] };
const assessment = { id: '507f1f77bcf86cd799439022', title: 'Java assessment', topic: 'Java', questionCount: 3, questions: [question, question, question], rewardEarned: false, passingScore: 70 };
let actor = admin; let _releaseSearch; let delayed = ''; let analyticsCount = 12; let failure = ''; let activeAnalytics = 0; let maxAnalytics = 0;
const calls = []; const writes = []; const response = (data, status = 200, extras = {}) => new Response(JSON.stringify({ success: status < 400, data, ...extras }), { status });
window.fetch = async (url, options = {}) => {
  const parsed = new URL(String(url), location.origin); const path = parsed.pathname; const query = parsed.searchParams; calls.push({ path, q: query.get('q'), from: query.get('from'), page: query.get('page') });
  if (options.body) writes.push({ path, body: JSON.parse(options.body) });
  if (path === '/api/auth/login') return response({ token: 'b1-fixture-' + actor.role, user: actor });
  if (path === '/api/users/me') return response(actor);
  if (path === '/api/users/tutors') {
    const q = query.get('q') || ''; const subject = query.get('subject');
    const rows = q === 'slow' ? [{ ...peer, name: 'Obsolete result' }] : (!q || peer.name.toLowerCase().includes(q.toLowerCase()) || peer.skillsToTeach.some(skill => skill.toLowerCase().includes(q.toLowerCase()))) && (!subject || peer.skillsToTeach.includes(subject)) ? [peer] : [];
    if (q === 'slow') return new Promise(resolve => { _releaseSearch = () => resolve(response(rows)); });
    if (q === 'unavailable') return response(null, 503, { message: 'Synthetic search unavailable.' });
    return response(rows);
  }
  if (path === '/api/credits/rules/current' || path === '/api/admin/credits/rules') return response({ tutoringSessionCost: 20, startingCreditGrant: 100, assessmentReward: 20, version: 1 });
  if (path === '/api/credits/mine') return response([], 200, { balance: 100, summary: { recordedEarned: 0, recordedSpent: 0 } });
  if (path === '/api/admin/overview') return response({ total: 3, students: 1, moderators: 1, suspended: 0, unverified: 0 });
  if (path === '/api/admin/operations') return response({ byStatus: { pending: 2, scheduled: 3, in_progress: 1, awaiting_validation: 2, disputed: 1 }, pendingResources: 2, pendingStudySets: 1, openStudyReports: 1, recentCredits: [{ _id: 'fixture-event', type: 'session_payment', amount: 20, createdAt: '2026-10-12T00:00:00Z' }] });
  if (path === '/api/admin/users') { const users = [student, peer, admin, moderator].filter(row => (!query.get('role') || row.role === query.get('role')) && (!query.get('id') || row._id === query.get('id')) && (!query.get('q') || row.name.toLowerCase().includes(query.get('q').toLowerCase()))); return response(users, 200, { pagination: { page: 1, total: users.length, pages: 1 } }); }
  if (path === '/api/admin/sessions') return response([{ _id: 'fixture-session', subject: 'Java', learner: student, tutor: peer, status: 'awaiting_validation', creditAmount: 20 }], 200, { pagination: { page: 1, total: 1, pages: 1 } });
  if (path === '/api/admin/credits/activity') return response([{ _id: 'ledger1', type: 'assessment_reward', amount: 20, toUserName: 'Elizabeth Olson', createdAt: new Date().toISOString() }, { _id: 'ledger2', type: 'session_payment', amount: 50, fromUserName: student.name, toUserName: peer.name, createdAt: new Date().toISOString() }]);
  if (path === '/api/admin/trust-summary' && failure === path) return response(null, 503, { message: 'Synthetic unavailable summary' });
  if (path === '/api/admin/trust-summary') return response({ protectionEvents: 3, roleChanges: 2, adminActions: 4, activeCooldowns: 1 });
  if (path === '/api/admin/audit-logs') { const page = Number(query.get('page') || 1); const security = query.get('scope') === 'security'; const q = query.get('q'); const rows = Array.from({ length: q ? 1 : 25 }, (_, i) => ({ _id: 'audit-' + page + '-' + i, actor: security ? null : { _id: admin._id, name: admin.name }, actorRole: security ? 'system' : 'admin', action: security ? 'security.login_cooldown_started' : 'user.role_changed', targetType: 'User', targetId: student._id, createdAt: new Date().toISOString(), summary: security ? 'Account cooldown started' : 'Role changed for fixture account', metadata: security ? {} : { previousRole: 'student', newRole: 'moderator', reference: 'synthetic-reference', amount: 50, direction: 'credit' } })); return response(rows, 200, { pagination: { page, limit: 25, total: q ? 1 : 30 } }); }
  if (path === '/api/moderator/overview') { const dates = recentRange(Number(query.get('days') || 7)); return response({ ...dates, counts: { pendingReviews: 3, reportedContent: 2, sessionDisputes: 1, decisionsToday: 4 }, queue: Array.from({ length: 5 }, (_, i) => ({ id: String(i), type: 'study', title: i ? 'Reported learning material ' + i : 'Java arrays practice', detail: 'Awaiting publication review', date: new Date().toISOString(), href: '/moderator/study-sets' })), recent: Array.from({ length: 5 }, (_, i) => ({ _id: String(i), actor: { name: moderator.name }, action: 'learning.resource_approved', summary: 'Approved resource ' + i, createdAt: new Date().toISOString(), metadata: {} })), trend: { decisions: [{ _id: dates.to, reviews: Number(query.get('days') || 7), sessions: 1 }], reports: [{ _id: dates.to, reports: 2 }] } }); }
  if (path === '/api/admin/security') return response({ counts: { cooldownStarted: 1, cooldownExtended: 0, recoveredLogins: 1, suspendedAttempts: 0, activeCooldowns: 0 }, events: [] });
  if (path.startsWith('/api/analytics/')) {
    activeAnalytics++; maxAnalytics = Math.max(maxAnalytics, activeAnalytics);
    await new Promise(resolve => setTimeout(resolve, 30)); activeAnalytics--;
    if (failure === path) return response(null, 503, { message: 'Synthetic analytics unavailable.' });
    const count = query.get('from') === recentRange(7).from ? 4 : analyticsCount;
    const data = path.endsWith('/subjects') ? [{ subject: 'Java', requestCount: count }]
      : path.endsWith('/sessions') ? { total: count, byStatus: { awaiting_validation: 2 }, trend: [{ _id: query.get('to'), count }] }
        : path.endsWith('/credits') ? { totalTransactions: 1, breakdown: { sessionTransferred: 20 }, trend: [{ _id: query.get('to'), count: 1 }] }
          : path.endsWith('/learning') ? { officialAttempts: 4, officialPassed: 3, officialPassRate: 75, practiceAttempts: 2, studyAttempts: 1, resourceUnlocks: 1, moduleUnlocks: 0, unlocks: 1 }
            : { averageRating: 4, totalRatings: 1, distribution: [{ _id: 4, count: 1 }] };
    if (path.endsWith('/sessions') && query.get('from') === delayed) return new Promise(resolve => { _releaseSearch = () => resolve(response(data)); });
    return response(data);
  }
  if (path === '/api/study-sets' || path === '/api/study-sets/shared') return response(query.get('q') && !study.title.toLowerCase().includes(query.get('q').toLowerCase()) ? [] : [study]);
  if (path === '/api/study-sets/results') return response(attempt.submittedAt ? [attempt] : []);
  if (path === `/api/study-sets/${study.id}/start`) return response(attempt);
  if (path === `/api/study-sets/attempts/${attempt.id}/submit`) { const answers = JSON.parse(options.body).answers; attempt = { ...attempt, answers, correct: answers[0] === 0 ? 1 : 0, total: 1, score: answers[0] === 0 ? 100 : 0, submittedAt: new Date().toISOString() }; return response(attempt); }
  if (path === `/api/study-sets/attempts/${attempt.id}`) return response(attempt);
  if (path === `/api/study-sets/${study.id}` || path === `/api/study-sets/${study.id}/review`) return response(study);
  if (path === '/api/assessments') return response([assessment]);
  if (path === `/api/assessments/${assessment.id}`) return response(assessment);
  if (path === `/api/assessments/${assessment.id}/practice`) return response({ passed: true, score: 100, mode: 'practice', rewardIssued: false, rewardEligible: true });
  if (path === '/api/notifications/unread-count') return response({ count: 1 });
  if (path === '/api/notifications') return response([{ id: 'fixture-notification', title: 'Session schedule proposed', message: 'Proposed: 2026-10-12T08:00:00.000Z (UTC).', href: '/sessions', type: 'session.reschedule', createdAt: '2026-10-12T00:00:00Z' }]);
  if (path === '/api/moderator/study-sets') return response([{ ...study, state: 'pending' }]);
  if (path.startsWith('/api/moderator') || path.startsWith('/api/learning') || path.startsWith('/api/sessions')) return response([]);
  throw new Error('Unexpected synthetic request: ' + path);
};
let bridge;
export function Bridge() { const auth = useAuth(); const navigate = useNavigate(); const location = useLocation(); useEffect(() => { bridge = { auth, navigate, location }; }, [auth, navigate, location]); return null; }
const pause = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const until = async (condition, message) => { for (let i = 0; i < 150; i++) { if (condition()) return; await pause(); } throw new Error(message); };
const button = text => [...document.querySelectorAll('button')].find(element => element.getClientRects().length && element.textContent.trim() === text);
const fill = (selector, value) => { const element = document.querySelector(selector); assert(element, 'Missing ' + selector); Object.getOwnPropertyDescriptor(element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); };
const go = async path => { bridge.navigate(path); await until(() => bridge.location.pathname === (path.startsWith('/admin/audit-logs') || path.startsWith('/admin/security') ? '/admin/trust-activity' : path.split('?')[0]), 'Navigate ' + path); await pause(100); };

const captureEnabled = new URLSearchParams(location.search).get('capture') === '/visual';
const capture = async name => { if (!captureEnabled) return; window.scrollTo(0, 0); await pause(100); window.__acadovaCapture = name; await until(() => !window.__acadovaCapture, 'Capture ' + name); };
const views = [];
const layout = label => { window.scrollTo(0,0); assert(document.documentElement.scrollWidth <= innerWidth + 1, 'Document overflow: ' + label); views.push(label); };
const kpi = label => [...document.querySelectorAll('.dashboard-kpi')].find(el => el.textContent.includes(label))?.querySelector('strong')?.textContent;
const alignment = () => { const cards = [...document.querySelectorAll('.dashboard-kpi')]; assert(cards.length === 4, 'Four KPI cards'); const tops = new Set(cards.map(el => Math.round(el.getBoundingClientRect().top))); if (innerWidth > 900) assert(tops.size === 1, 'Four column desktop KPI grid'); const heights = cards.map(el => Math.round(el.getBoundingClientRect().height)); if (innerWidth > 600) assert(Math.max(...heights) - Math.min(...heights) <= 1, 'Equal KPI heights'); const panels = [...document.querySelectorAll('.dashboard-panel-grid > section')].map(el => el.getBoundingClientRect()); if (innerWidth > 900) assert(Math.abs(panels[0].height - panels[1].height) <= 1 && panels[0].top === panels[1].top, 'Paired dashboard card alignment'); };
const navigation = async count => { const sidebar = document.querySelector('.staff-sidebar'); if (sidebar.getClientRects().length) { const nav = sidebar.querySelector('nav'); const links = [...nav.querySelectorAll('a')]; assert(links.length === count && links.every(el => el.querySelector('svg') && el.getBoundingClientRect().height >= 44), 'Accessible icon navigation'); assert(nav.scrollHeight <= nav.clientHeight + 1 && sidebar.scrollHeight <= sidebar.clientHeight + 1, 'Sidebar fits without scrolling'); assert(sidebar.querySelector('.staff-sidebar-bottom').getBoundingClientRect().top >= links.at(-1).getBoundingClientRect().bottom, 'Account footer below navigation'); } else { const trigger = document.querySelector('[aria-label="Open staff navigation"]'); trigger.focus(); window.__acadovaKey = 'Enter'; await until(() => !window.__acadovaKey, 'Native Enter handled'); await pause(60); await until(() => document.querySelector('[role=dialog]'), 'Keyboard navigation drawer'); assert(document.querySelectorAll('[role=dialog] nav a').length === count, 'All navigation destinations remain available'); layout('Staff navigation drawer'); window.__acadovaKey = 'Escape'; await until(() => !window.__acadovaKey, 'Native Escape handled'); await pause(60); await until(() => !document.querySelector('[role=dialog]'), 'Escape closes navigation'); assert(document.activeElement === trigger, 'Focus returns to navigation trigger');
 if (matchMedia('(pointer: coarse)').matches) {
  const tap = async element => { element.scrollIntoView({ block: 'center' }); await pause(100); const r = element.getBoundingClientRect(); window.__acadovaPointer = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; await until(() => !window.__acadovaPointer, 'Native pointer handled'); await pause(60); };
  await tap(trigger); await until(() => document.querySelector('[role=dialog]'), 'Coarse-pointer drawer open');
  const links = [...document.querySelectorAll('[role=dialog] nav a')]; const settings = links.at(-1); const target = settings.getAttribute('href'); await tap(settings);
  await until(() => !document.querySelector('[role=dialog]') && location.pathname === target, 'Coarse-pointer last navigation destination'); layout('Touch Settings');
  await go(count === 11 ? '/admin' : '/moderator'); await until(() => !document.querySelector('.dashboard-refresh-button').disabled, 'Dashboard restored after touch');
 }
 } };
localStorage.setItem('acadova_token', 'b3-fixture');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge /><App /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try {
 await until(() => bridge?.auth.isAuthenticated, 'Authenticated'); await go('/admin'); await until(() => kpi('Total Users') === '3', 'Real-shaped overview counts');
 assert(kpi('Current Tutoring') === '6', 'Pending scheduled and in-progress states'); alignment(); layout('Admin Overview'); await navigation(11); await capture('admin-overview');
 assert(document.querySelectorAll('.attention-list a').length === 5, 'Operational destinations preserved'); assert(document.querySelector('.ledger-transfer strong').textContent.startsWith('50'), 'Transfer is unsigned');
 button('7 days').click(); await until(() => location.search.includes('days=7') && !document.querySelector('.dashboard-refresh-button').disabled, '7 day trend fetch'); assert(document.querySelector('.dashboard-chart-legend').textContent.includes('Tutoring payment records'), 'Actual chart legend');
 button('Refresh overview').click(); await until(() => !document.querySelector('.dashboard-refresh-button').disabled, 'Manual refresh');
 await go('/admin/credits'); await until(() => document.getElementById('targetStudent'), 'Credits'); layout('Admin Credits'); const credits = [...document.querySelectorAll('.admin-credit-grid > section')].map(el => el.getBoundingClientRect()); if (credits.length === 2 && credits[0].top === credits[1].top) assert(Math.abs(credits[0].height - credits[1].height) <= 1, 'Credit card outer heights match'); await capture('admin-credits');
 await go('/admin/trust-activity'); await until(() => kpi('Protection Events') === '3' && document.querySelectorAll('tbody tr').length === 25, 'Trust data and server page'); alignment(); layout('Trust and Activity'); await capture('trust-activity'); failure = '/api/admin/trust-summary'; button('Refresh data').click(); await until(() => document.body.textContent.includes('Some data could not be refreshed') && !document.querySelector('.dashboard-refresh-button').disabled, 'Summary failure reported'); assert(kpi('Protection Events') === '3', 'Successful summary retained and marked stale'); failure = ''; button('Refresh data').click(); await until(() => !document.body.textContent.includes('Some data could not be refreshed') && !document.querySelector('.dashboard-refresh-button').disabled, 'Summary retry recovered');
 await until(() => button('Next') && !button('Next').disabled, 'Next page enabled'); button('Next').focus(); window.__acadovaKey = 'Enter'; await until(() => !window.__acadovaKey, 'Native Enter handled'); await pause(60); await until(() => location.search.includes('page=2') && document.querySelector('.trust-pagination')?.textContent.includes('Page 2') && document.querySelector('tbody tr') && !document.querySelector('.dashboard-refresh-button').disabled, 'Server-side next page');
 fill('input[type=search]', 'Admin'); await until(() => location.search.includes('q=Admin') && document.querySelectorAll('tbody tr').length === 1, 'Debounced Trust search');
 document.getElementById('trust-tab-activity').focus(); window.__acadovaKey = 'ArrowRight'; await until(() => !window.__acadovaKey, 'Native ArrowRight handled'); await pause(60); await until(() => document.getElementById('trust-tab-security').getAttribute('aria-selected') === 'true' && document.querySelector('tbody tr')?.textContent.includes('System'), 'Keyboard Security tab and scoped records'); assert(document.activeElement.id === 'trust-tab-security', 'Security tab focus retained'); layout('Security Events');
 window.__acadovaKey = 'ArrowRight'; await until(() => !window.__acadovaKey, 'Native ArrowRight handled'); await pause(60); await until(() => document.getElementById('trust-tab-protection').getAttribute('aria-selected') === 'true' && document.querySelector('.protection-counts'), 'Keyboard Login Protection tab'); layout('Login Protection');
 await go('/admin/security?category=cooldown&account=' + student._id + '&period=7d'); await until(() => location.search.includes('tab=security') && document.querySelector('#security-account')?.value === student._id, 'Legacy Security filters preserved'); assert(location.search.includes('securityCategory=cooldown') && location.search.includes('period=7d'), 'Legacy scope and rolling period preserved');
 await go('/admin/audit-logs?actor=' + admin._id + '&category=user'); await until(() => location.search.includes('tab=activity') && document.querySelector('#audit-actor')?.value === admin._id, 'Legacy Audit filters preserved'); layout('Legacy Audit redirect');
 await go('/admin/analytics'); await until(() => document.querySelectorAll('.metric-panel').length === 5, 'Five Analytics KPIs retained'); layout('Admin Analytics');
 actor = moderator; await bridge.auth.login('moderator@example.test', 'SyntheticFixture1!'); await until(() => bridge.auth.user?.role === 'moderator' && bridge.location.pathname === '/moderator', 'Moderator home'); await until(() => kpi('Pending Reviews') === '3', 'Moderator counts'); alignment(); layout('Moderator Overview'); await navigation(7); await capture('moderator-overview');
 button('30 days').click(); await until(() => location.search.includes('days=30') && !document.querySelector('.dashboard-refresh-button').disabled, 'Moderator date aggregation'); button('View all cases').click(); await until(() => document.getElementById('full-review-queue'), 'Original complete queue accessible'); layout('Full Moderator Queue');
 bridge.navigate('/admin/trust-activity'); await until(() => bridge.location.pathname === '/moderator', 'Moderator blocked from Admin dashboard');
 actor = student; await bridge.auth.login('student@example.test', 'SyntheticFixture1!'); await until(() => bridge.auth.user?.role === 'student' && bridge.location.pathname === '/dashboard', 'Student home');
 for (const route of ['/tutors','/learning','/study-sets','/assessments','/credits','/sessions','/settings']) { await go(route); await pause(100); layout('Student ' + route); }
 bridge.navigate('/admin'); await until(() => bridge.location.pathname === '/dashboard', 'Student blocked from Admin'); bridge.navigate('/moderator'); await until(() => bridge.location.pathname === '/dashboard', 'Student blocked from Moderator');
 assert(writes.every(row => row.path === '/api/auth/login'), 'Review never performs business writes');
 document.getElementById('result').textContent = `PASS: B.3 overview metrics, four KPIs, aligned paired panels and Credits, all icon destinations, keyboard drawer/tabs/focus, trend periods, Trust search/pagination/legacy filters, role guards and ${views.length} layout checks at ${innerWidth}x${innerHeight}. Synthetic HTTP only; database integration is a separate suite.`;
} catch(error) { document.getElementById('result').textContent = 'FAIL: ' + error.message + ' | ' + location.pathname + location.search + ' | nextDisabled=' + button('Next')?.disabled + ' pagination=' + document.querySelector('.trust-pagination')?.textContent + ' calls=' + JSON.stringify(calls.slice(-8)); }
