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
let reviewRows = [{ ...study, state: 'pending', isOwner: false }, { ...study, id: '507f1f77bcf86cd799439030', title: 'Reported functions', state: 'published', isOwner: false, reports: [{ id: '507f1f77bcf86cd799439031', reporterName: 'Synthetic reporter', reason: 'Synthetic content review', cycle: 1, revision: 1 }] }];
const sessionRows = Array.from({ length: 13 }, (_, i) => ({ _id: String(40 + i).padStart(24, '0'), subject: 'Java session ' + i, learner: i ? peer : student, tutor: i ? student : peer, status: i < 8 ? 'scheduled' : 'completed', ratingEligible: i >= 8, confirmedAt: i >= 8 ? '2026-10-01T00:00:00Z' : null, creditAmount: 20, scheduledStart: '2026-11-01T08:00:00Z' }));
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
  if (path === '/api/moderator/study-sets') return response(query.get('view') === 'removed' ? [{ ...reviewRows[0], state: 'removed' }] : reviewRows);
  if (path === '/api/sessions') return response(sessionRows);
  if (path.endsWith('/decision') && path.startsWith('/api/moderator/study-sets/')) { const id = path.split('/')[4]; const body = JSON.parse(options.body); reviewRows = reviewRows.map(row => row.id === id ? { ...row, state: body.outcome === 'approve' ? 'published' : 'rejected', version: row.version + 1 } : row); return response(reviewRows.find(row => row.id === id)); }
  if (path.endsWith('/close') && path.startsWith('/api/moderator/study-sets/reports/')) { reviewRows = reviewRows.map(row => ({ ...row, reports: [] })); return response({}); }
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


const before = new URLSearchParams(location.search).get('capture') === '/before';
const observations = []; const captures = [];
const key = async value => { window.__acadovaKey = value; await until(() => !window.__acadovaKey, 'Native key handled'); await pause(60); };
const capture = async name => { document.querySelectorAll('.app-toast button').forEach(el => el.click()); window.scrollTo(0,0); await pause(100); if (!window.__acadovaCaptureEnabled) return; window.__acadovaCapture = (before ? 'before-' : 'after-') + name; await until(() => !window.__acadovaCapture, 'Capture ' + name); captures.push(name); };
const layout = () => assert(document.documentElement.scrollWidth <= innerWidth + 1, 'No document overflow');
const nav = async count => { const side = document.querySelector('.staff-sidebar'); const visible = Boolean(side.getClientRects().length); observations.push({ role: actor.role, width: innerWidth, height: innerHeight, sidebar: visible, heightQuery: matchMedia('(max-height:700px)').matches }); if (before) return;
 assert(visible === (innerWidth > 1024), 'Sidebar uses width, not desktop height');
 if (visible) { const links = [...side.querySelectorAll('nav a')]; assert(links.length === count && links.every(el => el.getBoundingClientRect().height >= 44), 'All links have accessible targets'); const list = side.querySelector('nav'); const foot = side.querySelector('.staff-sidebar-bottom'); assert(list.getBoundingClientRect().bottom <= foot.getBoundingClientRect().top + 1, 'Footer does not overlap navigation'); if (innerHeight >= 720) assert(list.scrollHeight <= list.clientHeight + 1, 'Navigation fits regular desktop height'); links.at(-1).scrollIntoView({ block: 'nearest' }); assert(links.at(-1).getBoundingClientRect().bottom <= foot.getBoundingClientRect().top + 1, 'Last destination reachable'); side.querySelector('.account-trigger').click(); await until(() => side.querySelector('.account-actions'), 'Account menu'); assert(side.querySelector('.account-actions').getBoundingClientRect().left >= side.getBoundingClientRect().right, 'Account popup beside sidebar'); await key('Escape'); }
 else { const trigger = document.querySelector('[aria-label="Open staff navigation"]'); trigger.focus(); await key('Enter'); await until(() => document.querySelector('[role=dialog]'), 'Drawer opened'); assert(document.querySelectorAll('[role=dialog] nav a').length === count, 'All drawer links available'); await key('Escape'); await until(() => !document.querySelector('[role=dialog]'), 'Drawer closed'); assert(document.activeElement === trigger, 'Focus restored'); }
 layout(); };
const reviews = async () => { await until(() => document.querySelectorAll('.study-card').length === 2, 'Review records loaded'); if (before) return;
 assert(document.querySelector('main h1').textContent === 'Study-set Reviews', 'Concise shared heading'); const h = document.querySelector('main h1').getBoundingClientRect(); const p = document.querySelector('.staff-page-header p').getBoundingClientRect(); assert(p.top >= h.bottom - 1 && Math.abs(p.left - h.left) <= 1, 'Description below heading');
 const tabs = document.querySelector('.study-review-tabs'); const toolbar = document.querySelector('.study-review-toolbar'); const results = document.querySelector('.study-review-results'); assert(tabs.getBoundingClientRect().bottom <= toolbar.getBoundingClientRect().top && toolbar.getBoundingClientRect().bottom <= results.getBoundingClientRect().top, 'Tabs then toolbar then results'); assert(toolbar.contains(button('Refresh')) && toolbar.querySelector('[role=status]'), 'Count and refresh in toolbar'); if(innerWidth >= 1280) { const controls = [toolbar.querySelector('input'),toolbar.querySelector('select'),button('Clear filters'),button('Refresh')].map(el=>el.getBoundingClientRect()); assert(Math.max(...controls.map(r=>r.bottom))-Math.min(...controls.map(r=>r.bottom)) <= 1, 'Desktop controls aligned'); }
 fill('.study-review-toolbar input[type=search]', 'Reported'); await until(() => document.querySelectorAll('.study-card').length === 1, 'Search unchanged'); button('Clear filters').click(); await until(() => document.querySelectorAll('.study-card').length === 2, 'Clear filters'); fill('.study-review-toolbar select','reports'); await until(() => document.querySelectorAll('.study-card').length === 1 && document.querySelector('.study-card h2').textContent === 'Reported functions', 'Case type retains correct record'); button('Clear filters').click(); await until(() => document.querySelectorAll('.study-card').length === 2, 'Clear case type'); layout(); };
localStorage.setItem('acadova_token','correction-fixture');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge /><App /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try {
 await until(()=>bridge?.auth.isAuthenticated,'Authenticated'); await go('/admin'); await until(()=>document.querySelector('.dashboard-kpi-value')?.textContent === '3','Admin counts'); await nav(11); await capture('admin-overview');
 await go('/admin/study-sets'); await reviews(); await capture('admin-study-reviews');
 actor=moderator;await bridge.auth.login('moderator@example.test','SyntheticFixture1!');await until(()=>bridge.auth.user?.role==='moderator' && bridge.location.pathname==='/moderator','Moderator home');await until(()=>document.querySelector('.dashboard-kpi-value')?.textContent==='3','Moderator counts');await nav(7);await capture('moderator-overview');
 await go('/moderator/study-sets');await reviews();await capture('moderator-study-reviews');
 if(!before){ button('Approve study publication').click();await until(()=>document.getElementById('confirmation-reason'),'Reason dialog');const textarea=document.getElementById('confirmation-reason');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(textarea,'Synthetic authorized review reason');textarea.dispatchEvent(new Event('input',{bubbles:true}));await pause();button('Record study decision').click();await until(()=>!document.querySelector('[role=dialog]') && reviewRows[0].state==='published','Publication decision remains functional');await until(()=>button('Close report without removal'),'Report action');button('Close report without removal').click();await until(()=>document.getElementById('confirmation-reason'),'Report reason dialog');const reason=document.getElementById('confirmation-reason');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(reason,'Synthetic report closure reason');reason.dispatchEvent(new Event('input',{bubbles:true}));await pause();button('Close report with reason').click();await until(()=>!document.querySelector('[role=dialog]') && reviewRows.every(r=>!r.reports.length),'Report closure preserved');
 const removed=[...document.querySelectorAll('.study-review-tabs a')].find(el=>el.textContent.includes('Removed'));removed.click();await until(()=>location.search.includes('view=removed') && button('Restore reviewed study revision'),'Removed tab and restoration action');layout(); }
 actor=student;await bridge.auth.login('student@example.test','SyntheticFixture1!');await until(()=>bridge.auth.user?.role==='student' && bridge.location.pathname==='/dashboard','Student home');await go('/sessions');await until(()=>document.querySelector('.student-session-filters button')?.textContent==='All (13)','Session counts');await capture('student-sessions');
 const groups=[...document.querySelectorAll('.student-session-filters > .session-filter-group')];observations.push({ sessionsSameRow: Math.abs(groups[0].getBoundingClientRect().top-groups[1].getBoundingClientRect().top)<2 });
 if(!before){if(innerWidth>1024)assert(Math.abs((groups[0].getBoundingClientRect().top+groups[0].getBoundingClientRect().height/2)-(groups[1].getBoundingClientRect().top+groups[1].getBoundingClientRect().height/2))<2,'Status on same desktop row');button('Learning (1)').click();await until(()=>document.querySelectorAll('.student-session-card').length===1,'Learning filter');button('Teaching (12)').click();await until(()=>document.querySelectorAll('.student-session-card').length===12,'Teaching filter');fill('#session-status','completed');await until(()=>document.querySelectorAll('.student-session-card').length===5,'Status intersects role correctly');assert(button('All (13)')&&button('Learning (1)')&&button('Teaching (12)'),'Counts unchanged by filtering');layout();assert(writes.filter(r=>!r.path.includes('/auth/login')).every(r=>r.path.endsWith('/decision')||r.path.endsWith('/close')),'No session/credit writes');}
 document.getElementById('result').textContent='PASS: '+(before?'Before layout observations':'UI corrections: desktop sidebar, accessible short-height fallback/drawer, stacked review hierarchy/toolbar, review decisions/reports, first-row Status and correct filters')+' '+JSON.stringify(observations);
} catch(error){document.getElementById('result').textContent='FAIL: '+error.message+' | '+location.pathname+location.search+' | '+document.querySelector('main')?.textContent.slice(-300);}
