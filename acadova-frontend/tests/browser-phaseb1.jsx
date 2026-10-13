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
let actor = student; let releaseSearch; let delayed = ''; let analyticsCount = 12; let failure = ''; let activeAnalytics = 0; let maxAnalytics = 0;
const calls = []; const writes = []; const response = (data, status = 200, extras = {}) => new Response(JSON.stringify({ success: status < 400, data, ...extras }), { status });
window.fetch = async (url, options = {}) => {
  const parsed = new URL(String(url), location.origin); const path = parsed.pathname; const query = parsed.searchParams; calls.push({ path, q: query.get('q'), from: query.get('from') });
  if (options.body) writes.push({ path, body: JSON.parse(options.body) });
  if (path === '/api/auth/login') return response({ token: 'b1-fixture-' + actor.role, user: actor });
  if (path === '/api/users/me') return response(actor);
  if (path === '/api/users/tutors') {
    const q = query.get('q') || ''; const subject = query.get('subject');
    const rows = q === 'slow' ? [{ ...peer, name: 'Obsolete result' }] : (!q || peer.name.toLowerCase().includes(q.toLowerCase()) || peer.skillsToTeach.some(skill => skill.toLowerCase().includes(q.toLowerCase()))) && (!subject || peer.skillsToTeach.includes(subject)) ? [peer] : [];
    if (q === 'slow') return new Promise(resolve => { releaseSearch = () => resolve(response(rows)); });
    if (q === 'unavailable') return response(null, 503, { message: 'Synthetic search unavailable.' });
    return response(rows);
  }
  if (path === '/api/credits/rules/current' || path === '/api/admin/credits/rules') return response({ tutoringSessionCost: 20, startingCreditGrant: 100, assessmentReward: 20, version: 1 });
  if (path === '/api/credits/mine') return response([], 200, { balance: 100, summary: { recordedEarned: 0, recordedSpent: 0 } });
  if (path === '/api/admin/trust-summary') return response({ protectionEvents: 0, roleChanges: 0, adminActions: 0, activeCooldowns: 0 });
  if (path === '/api/moderator/overview') return response({ ...recentRange(7), counts: { pendingReviews: 1, reportedContent: 0, sessionDisputes: 0, decisionsToday: 0 }, queue: [], recent: [], trend: { decisions: [], reports: [] } });
  if (path === '/api/admin/overview') return response({ total: 3, students: 1, moderators: 1, suspended: 0, unverified: 0 });
  if (path === '/api/admin/operations') return response({ byStatus: { pending: 2, scheduled: 3, in_progress: 1, awaiting_validation: 2, disputed: 1 }, pendingResources: 2, pendingStudySets: 1, openStudyReports: 1, recentCredits: [{ _id: 'fixture-event', type: 'session_payment', amount: 20, createdAt: '2026-10-12T00:00:00Z' }] });
  if (path === '/api/admin/users') { const users = [student, peer, admin, moderator].filter(row => (!query.get('role') || row.role === query.get('role')) && (!query.get('id') || row._id === query.get('id')) && (!query.get('q') || row.name.toLowerCase().includes(query.get('q').toLowerCase()))); return response(users, 200, { pagination: { page: 1, total: users.length, pages: 1 } }); }
  if (path === '/api/admin/sessions') return response([{ _id: 'fixture-session', subject: 'Java', learner: student, tutor: peer, status: 'awaiting_validation', creditAmount: 20 }], 200, { pagination: { page: 1, total: 1, pages: 1 } });
  if (path === '/api/admin/credits/activity') return response([]);
  if (path === '/api/admin/audit-logs') return response([], 200, { pagination: { page: 1, limit: 25, total: 0 } });
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
    if (path.endsWith('/sessions') && query.get('from') === delayed) return new Promise(resolve => { releaseSearch = () => resolve(response(data)); });
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
if (new URLSearchParams(location.search).get('capture') === '/visual') sessionStorage.setItem('b1-visual', '1');
const captureEnabled = sessionStorage.getItem('b1-visual') === '1';
const capture = async name => { if (!captureEnabled) return; document.querySelectorAll('.app-toast button').forEach(button => button.click()); await pause(); window.__acadovaCapture = name; await until(() => !window.__acadovaCapture, 'Capture ' + name); };
const views = [];
const layout = label => { window.scrollTo(0, 0); const overflow = [...document.querySelectorAll('body *')].filter(el => el.getClientRects().length && el.getBoundingClientRect().right > innerWidth + 1 && !el.closest('.table-responsive')); assert(document.documentElement.scrollWidth <= innerWidth + 1, 'Document overflow on ' + label + ': ' + overflow.slice(0, 4).map(el => el.className).join(', ')); const heading = document.querySelector('main h1'); if (heading) assert(heading.getBoundingClientRect().top >= 0, 'Heading clipped on ' + label); views.push(label); };
const metric = label => [...document.querySelectorAll('.metric-panel')].find(el => el.textContent.includes(label))?.querySelector('strong')?.textContent;
localStorage.setItem('acadova_token', 'b1-fixture');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge /><App /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try {
  await until(() => bridge?.auth.isAuthenticated, 'Authenticated'); await go('/settings'); await until(() => document.querySelector('[role=switch]'), 'Settings accessible');
  if (!sessionStorage.getItem('b1-reloaded')) { document.querySelector('[role=switch]').focus(); window.__acadovaKey = 'Enter'; await until(() => localStorage.getItem('acadova:sound:' + student._id) === 'on', 'Sound preference saved'); sessionStorage.setItem('b1-reloaded', '1'); location.reload(); }
  else {
    assert(document.querySelector('[role=switch]').getAttribute('aria-checked') === 'true', 'Sound survives actual browser reload'); layout('Student Settings'); await capture('student-settings');
    await go('/tutors'); await until(() => document.querySelector('.peer-card'), 'Tutor directory'); fill('#tutor-search', 'eliza');
    await until(() => location.search.includes('q=eliza') && document.querySelector('.peer-card')?.textContent.includes('Elizabeth Olson'), 'Automatic partial name match');
    button('Database').click(); await until(() => document.body.textContent.includes('No tutors match'), 'Text and subject intersection'); button('All').click(); await until(() => document.querySelector('.peer-card'), 'Clearing subject preserves name');
    fill('#tutor-search', 'slow'); await until(() => releaseSearch, 'Slow request captured'); fill('#tutor-search', 'e'); fill('#tutor-search', 'eliz'); fill('#tutor-search', 'eliza'); await until(() => document.querySelector('.peer-card')?.textContent.includes('Elizabeth Olson'), 'Rapid input latest result'); releaseSearch(); await pause(100); assert(!document.body.textContent.includes('Obsolete result'), 'Stale response discarded');
    assert(calls.filter(row => row.path === '/api/users/tutors' && ['e', 'eliz'].includes(row.q)).length === 0, 'Typing debounced');
    fill('#tutor-search', 'Python'); await until(() => location.search.includes('Python') && document.querySelector('.peer-card'), 'Subject text automatic'); history.back(); await until(() => document.getElementById('tutor-search')?.value === 'eliza', 'Back restores query'); layout('Find Tutors');
    await until(() => button('Request Session'), 'Restored search results'); button('Request Session').click(); await until(() => document.querySelector('[role=dialog]'), 'Request modal'); layout('Request modal'); const close = document.querySelector('[role=dialog] button[aria-label="Close dialog"]') || document.querySelector('[role=dialog] button[aria-label="Close"]'); if (close) close.click(); else { window.__acadovaKey = 'Escape'; await until(() => !document.querySelector('[role=dialog]'), 'Escape closes modal'); }
    const bell = [...document.querySelectorAll('.notification-trigger')].find(el => el.getClientRects().length); bell.click(); await until(() => document.querySelector('.notification-panel'), 'Bell list'); assert(!document.querySelector('.notification-panel').textContent.includes('notification sound'), 'Sound controls removed from bell'); assert(!document.querySelector('.notification-list').textContent.includes('T08:00'), 'Local notification date'); layout('Notification dropdown'); document.querySelector('button[aria-label="Close notifications"]').click();
    await go('/learning'); await until(() => document.querySelector('.learning-page-header'), 'Learning'); const learningWidth = document.querySelector('main').getBoundingClientRect().width; layout('Learning');
    await go('/study-sets'); await until(() => document.querySelector('.study-card'), 'Study cards'); assert(document.querySelector('main').getBoundingClientRect().width === learningWidth && !document.querySelector('.study-page').classList.contains('container-narrow'), 'Study Sets shared layout'); layout('Study Sets'); await capture('study-sets');
    await go('/study-sets?view=shared'); await until(() => document.getElementById('study-search'), 'Shared search'); fill('#study-search', 'missing'); await until(() => document.body.textContent.includes('No approved sets found'), 'Study search automatic');
    await go('/study-sets/new'); await until(() => document.getElementById('study-title'), 'Draft editor'); layout('Study editor');
    await go(`/study-sets/${study.id}`); await until(() => button('Start free quiz'), 'Study detail'); button('Start free quiz').click(); await until(() => document.querySelector('input[name="study-answer-0"]'), 'Free quiz'); layout('Study quiz'); button('Submit study answers').click(); await until(() => document.activeElement.name === 'study-answer-0', 'Study missing answer focus'); document.querySelector('input[name="study-answer-0"]').click(); button('Submit study answers').click(); await until(() => document.body.textContent.includes('Score: 100%'), 'Study result'); assert(document.body.textContent.includes('No credits awarded'), 'Study zero credits'); layout('Study result');
    await go(`/assessments?open=${assessment.id}`); await until(() => document.querySelector('.assessment-mode'), 'Styled attempt mode'); layout('Assessment'); await capture('assessment'); button('Submit answers').click(); await until(() => document.getElementById('assessment-answer-error'), 'Required answers validated'); document.querySelector('input[name=attempt-mode]').focus(); window.__acadovaKey = 'ArrowDown'; await until(() => document.querySelectorAll('input[name=attempt-mode]')[1].checked, 'Keyboard practice selection');
    for (let i = 0; i < 3; i++) document.querySelector(`input[name="question-${i}"]`).click(); button('Submit answers').click(); await until(() => document.querySelector('.assessment-result'), 'Practice result'); assert(writes.at(-1).path.endsWith('/practice'), 'Practice endpoint preserved'); assert(document.body.textContent.includes('no reward eligibility consumed'), 'Eligibility explained'); button('Try again').click(); await until(() => document.querySelectorAll('.quiz-question').length === 3, 'Retry resets answers');
    actor = admin; await bridge.auth.login('admin@example.test', 'SyntheticFixture1!'); await until(() => bridge.auth.user?.role === 'admin' && bridge.location.pathname === '/admin', 'Admin home'); await until(() => document.querySelector('.attention-list .record-count')?.textContent === '2', 'Actual attention count'); layout('Admin Overview'); await capture('admin-overview');
    await go('/admin/settings'); await until(() => document.querySelector('[role=switch]'), 'Admin Settings'); assert(document.querySelector('[role=switch]').getAttribute('aria-checked') === 'false', 'Preference isolated per account'); layout('Admin Settings');
    await go('/admin/users'); await until(() => document.querySelector('tbody tr'), 'Users'); fill('input[type=search]', 'eliza'); await until(() => document.querySelectorAll('tbody tr').length === 1, 'Bounded server user search'); layout('Admin Users');
    await go('/admin/sessions'); await until(() => document.querySelector('tbody tr'), 'Sessions'); fill('input[type=search]', 'eliza'); await until(() => calls.some(row => row.path === '/api/admin/sessions' && row.q === 'eliza'), 'Session name search server-side'); layout('Admin Sessions');
    await go('/admin/credits'); await until(() => document.getElementById('targetStudent'), 'Credits'); layout('Admin Credits');
    await go('/admin/analytics'); await until(() => metric('Session requests') === '12', 'Analytics'); layout('Admin Analytics'); await capture('admin-analytics'); assert(document.querySelectorAll('.metric-panel').length === 5 && document.querySelectorAll('.analytics-comparison').length === 2, 'KPIs and charts retained');
    analyticsCount = 15; button('Refresh analytics').click(); await until(() => metric('Session requests') === '15', 'Manual refresh without reload'); assert(document.querySelector('.dashboard-refresh').textContent.includes('Last updated'), 'Successful update time');
    failure = '/api/analytics/learning'; button('Refresh analytics').click(); await until(() => button('Retry unavailable analytics'), 'Refresh failure shown'); assert(metric('Official assessment pass rate') === '75%', 'Good data retained on failure'); failure = ''; button('Retry unavailable analytics').click(); await until(() => !button('Retry unavailable analytics'), 'Retry success');
    analyticsCount = 16; window.dispatchEvent(new CustomEvent('acadova:data-changed', { detail: { endpoint: '/api/admin/credits/adjustments' } })); await until(() => metric('Session requests') === '16', 'Relevant action revalidation');
    button('Last 7 days').click(); await until(() => metric('Session requests') === '4', 'Date filters update values'); delayed = recentRange(90).from; releaseSearch = null; button('Last 90 days').click(); await until(() => releaseSearch, 'Old date response captured'); button('Last 7 days').click(); releaseSearch(); await until(() => metric('Session requests') === '4', 'Stale date response discarded'); delayed = ''; assert(maxAnalytics <= 5, 'One set of dashboard requests at a time');
    await go('/admin/security'); await until(() => document.getElementById('trust-tab-security')?.getAttribute('aria-selected') === 'true', 'Security data'); assert(document.body.textContent.includes('Account Protection'), 'Account protection preserved'); layout('Security Center');
    await go('/admin/audit-logs'); await until(() => button('Clear filters'), 'Audit'); layout('Audit Logs');
    actor = moderator; await bridge.auth.login('moderator@example.test', 'SyntheticFixture1!'); await until(() => bridge.auth.user?.role === 'moderator' && bridge.location.pathname === '/moderator', 'Moderator home'); await until(() => !document.querySelector('.loading-spinner'), 'Moderator load'); layout('Moderator Overview');
    await go('/moderator/settings'); await until(() => document.querySelector('[role=switch]'), 'Moderator Settings'); layout('Moderator Settings'); await go('/moderator/study-sets'); await until(() => document.querySelector('.study-card'), 'Moderation list'); layout('Moderator Study review');
    actor = student; await bridge.auth.login('student@example.test', 'SyntheticFixture1!'); await until(() => bridge.auth.user?.role === 'student' && bridge.location.pathname === '/dashboard', 'Student home'); await go('/settings'); await until(() => document.querySelector('[role=switch]'), 'Return to Student Settings'); assert(document.querySelector('[role=switch]').getAttribute('aria-checked') === 'true', 'Student preference retained across roles'); document.querySelector('[role=switch]').click(); await until(() => localStorage.getItem('acadova:sound:' + student._id) === 'off', 'Sound off works');
    assert(writes.filter(row => !row.path.includes('/auth/login')).every(row => row.path.endsWith('/start') || row.path.endsWith('/submit') || row.path.endsWith('/practice')), 'Only intended synthetic quiz writes');
    document.getElementById('result').textContent = `PASS: B.1 partial name/subject typing, debounce/stale/history, real sound reload/account isolation, free quiz/practice/result/retry, role Settings, operations, manual/action/stale analytics refresh, Security and ${views.length} overflow/layout checks at ${innerWidth}×${innerHeight}. Synthetic HTTP only.`;
  }
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.message + ' | query=' + location.search + ' input=' + document.getElementById('tutor-search')?.value + ' recent=' + JSON.stringify(calls.slice(-8)) + ' text=' + document.querySelector('main')?.textContent.slice(-450); }
