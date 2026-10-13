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
let createdDraft = null; let actor = admin; let _releaseSearch; let delayed = ''; let analyticsCount = 12; let failure = ''; let activeAnalytics = 0; let maxAnalytics = 0;
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
  if (path === '/api/moderator/assessments' && options.method === 'POST') {
    const body = JSON.parse(options.body); createdDraft = body;
    return response({ id: assessment.id, ...body, status: 'draft' });
  }
  if (path === '/api/moderator/assessments') return response([{ ...assessment, status: 'draft' }]);
  if (path === `/api/moderator/assessments/${assessment.id}`) return response({ ...assessment, status: 'draft', questions: [question] });
  if (path === '/api/moderator/ratings') return response([{ _id: 'review-fixture', rating: 4, comment: 'Synthetic review', session: { subject: 'Synthetic Java session' }, fromUser: student, toUser: peer, isHidden: false }]);
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
const observations = [];
const key = async value => { window.__acadovaKey = value; await until(() => !window.__acadovaKey, 'Native key handled'); await pause(); };
const capture = async name => {
  await pause(120); if (!window.__acadovaCaptureEnabled) return;
  window.__acadovaCapture = (before ? 'before-' : 'after-') + name;
  await until(() => !window.__acadovaCapture, 'Capture ' + name);
};
const layout = () => assert(document.documentElement.scrollWidth <= innerWidth + 1, 'No document-level horizontal overflow');
const cards = () => [...document.querySelectorAll('#assessment-management-panel-builder fieldset')];
const editorLayout = async () => {
  const rows = cards();
  for (const [i, card] of rows.entries()) {
    const box = card.getBoundingClientRect();
    if (i) assert(box.top >= rows[i - 1].getBoundingClientRect().bottom, 'Question cards do not overlap');
    for (const control of card.querySelectorAll('input,select,button')) {
      const rect = control.getBoundingClientRect(); const style = getComputedStyle(control.closest('.learning-builder-actions') || control);
      assert(style.position !== 'sticky' && style.position !== 'fixed', 'Question controls scroll naturally');
      assert(rect.left >= box.left && rect.right <= box.right + 1 && rect.top >= box.top && rect.bottom <= box.bottom + 1, 'Every control remains inside its question');
    }
  }
  layout();
};
const navigation = async () => {
  const side = document.querySelector('.staff-sidebar');
  assert(Boolean(side.getClientRects().length) === (innerWidth > 1024), 'Sidebar visibility depends on width, not height');
  if (innerWidth > 1024) {
    const nav = side.querySelector('nav'); const bottom = side.querySelector('.staff-sidebar-bottom');
    assert(nav.getBoundingClientRect().bottom <= bottom.getBoundingClientRect().top + 1, 'Navigation and account do not overlap');
    for (const link of nav.querySelectorAll('a')) assert(link.getBoundingClientRect().height >= 44, 'Accessible desktop target');
    if (innerHeight >= 720) assert(nav.scrollHeight <= nav.clientHeight + 1, 'Complete desktop navigation fits');
    nav.querySelector('a:last-child').scrollIntoView({ block: 'nearest' });
  } else {
    const trigger = document.querySelector('[aria-label="Open staff navigation"]'); trigger.focus(); await key('Enter');
    await until(() => document.querySelector('[role=dialog] nav'), 'Mobile keyboard drawer');
    await key('Escape'); await until(() => !document.querySelector('[role=dialog]'), 'Drawer closes');
    assert(document.activeElement === trigger, 'Drawer restores focus');
  }
};
localStorage.setItem('acadova_token','c1-synthetic-fixture');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge /><App /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try {
  await until(() => bridge?.auth.isAuthenticated, 'Authenticated'); await go('/admin');
  await until(() => document.querySelector('.dashboard-kpi-value')?.textContent === '3', 'Actual dashboard components loaded');
  window.scrollTo(0, 0); await capture('admin-overview');
  const kpis = [...document.querySelectorAll('.dashboard-kpi')].map(el => el.getBoundingClientRect());
  observations.push({ viewport: [innerWidth,innerHeight], visualScale: visualViewport.scale, kpiHeights: kpis.map(r=>r.height), chartTop: document.querySelector('.dashboard-trend-panel').getBoundingClientRect().top });
  if (!before) { await navigation(); layout(); if (innerWidth > 1024) {
    assert(Math.max(...kpis.map(r=>r.height))-Math.min(...kpis.map(r=>r.height)) <= 1, 'Equal-height KPIs');
    assert(kpis.every(r=>r.height <= 130), 'Compact desktop KPI proportions');
    if (innerHeight >= 720) assert(document.querySelector('.dashboard-trend-panel').getBoundingClientRect().top < innerHeight, 'Chart heading visible on regular desktop');
  }}
  await go('/admin/moderation'); await until(() => document.querySelector('.staff-review-card'), 'Review data loaded');
  window.scrollTo(0,0); await capture('admin-moderation');
  const disputeLink = [...document.querySelectorAll('main a')].find(el => /Session disputes|Review session disputes/.test(el.textContent));
  assert(disputeLink, 'Disputes action exists'); observations.push({ disputeHref: disputeLink.getAttribute('href') });
  if (!before) {
    assert(disputeLink.getAttribute('href') === '/admin/disputes', 'Admin destination preserves shell');
    assert(document.querySelector('.moderation-toolbar').contains(disputeLink), 'Action accompanies filters');
    disputeLink.focus(); await key('Enter'); await until(() => location.pathname === '/admin/disputes' && document.querySelector('.staff-data-note'), 'Authorized dispute destination loaded');
    assert(document.querySelector('.staff-eyebrow').textContent === 'Administration / Sessions', 'Correct dispute breadcrumb');
    assert(document.querySelector('.staff-topbar strong').textContent === 'Administration', 'Correct admin shell');
    bridge.navigate(-1); await until(() => location.pathname === '/admin/moderation' && document.querySelector('.staff-review-card'), 'Browser Back restores moderation'); layout();
  }
  await go('/admin/assessments'); button('Create / edit').click(); await until(() => cards().length === 3, 'Three questions rendered');
  const third = cards()[2]; third.scrollIntoView({ block: 'center', behavior: 'instant' }); await pause();
  observations.push({ questionActionsPosition: getComputedStyle(third.querySelector('.learning-builder-actions')).position,
    editorDisplay: getComputedStyle(document.querySelector('#assessment-management-panel-builder')).display });
  await capture('assessment-question-three');
  if (!before) {
    await editorLayout();
    fill('#assessment-title', 'Synthetic assessment draft'); fill('#assessment-topic', 'Java');
    for (let i=0;i<3;i++) { fill(`#assessment-prompt-${i}`, `Question prompt ${i+1}`); for(let j=0;j<3;j++)fill(`#assessment-option-${i}-${j}`,`Answer ${j+1}`); }
    const add = cards()[2].querySelector('button'); add.focus(); await key('Enter'); await until(()=>cards()[2].querySelectorAll('input').length===5,'Fourth option added');
    assert(document.activeElement.id==='assessment-option-2-3','Focus follows added option'); fill('#assessment-option-2-3','Fourth answer'); fill('#assessment-answer-2','3');
    cards()[2].querySelector('button').click(); await until(()=>cards()[2].querySelectorAll('input').length===6,'Fifth option added');
    assert(cards()[2].querySelector('button').disabled,'Five-option limit retained');fill('#assessment-answer-2','4');
    cards()[2].querySelectorAll('button')[1].click();await until(()=>cards()[2].querySelectorAll('input').length===5,'Fifth option removed');
    assert(document.querySelector('#assessment-answer-2').value==='3','Removed fifth correct answer clamped');
    cards()[2].querySelectorAll('button')[1].click(); await until(()=>cards()[2].querySelectorAll('input').length===4,'Last option removed');
    assert(document.querySelector('#assessment-answer-2').value==='2','Correct index stays valid');
    cards()[0].querySelectorAll('button')[1].click();await until(()=>cards()[0].querySelectorAll('input').length===3,'Minimum two options');
    assert(cards()[0].querySelectorAll('button')[1].disabled,'Two-option minimum retained');cards()[0].querySelector('button').click();await until(()=>cards()[0].querySelectorAll('input').length===4,'Third option restored');fill('#assessment-option-0-2','Restored answer');
    button('Add question').click(); await until(()=>cards().length===4,'Fourth question');
    fill('#assessment-prompt-3','Fourth preserved question'); const retained=cards()[3]; cards()[1].querySelectorAll('button')[2].click();
    await until(()=>cards().length===3,'Remove middle question');
    assert(cards()[2]===retained && document.querySelector('#assessment-prompt-2').value==='Fourth preserved question','Stable card identity and values after removal');
    assert(document.activeElement.id==='assessment-prompt-1','Focus moves to nearby remaining question');
    fill('#assessment-prompt-2','Final question prompt'); for(let j=0;j<3;j++)fill(`#assessment-option-2-${j}`,`Final answer ${j+1}`);
    await editorLayout(); button('Create draft').click(); await until(()=>createdDraft,'Draft submitted');
    assert(createdDraft.questions.length===3 && createdDraft.questions.every(q=>!('key' in q) && !('clientId' in q)),'Only API question fields submitted');
    await until(()=>cards().length===3 && document.querySelector('#assessment-title').value==='','Draft reset after save');
    for(let i=3;i<10;i++) { button('Add question').click(); await until(()=>cards().length===i+1,'Question count '+(i+1)); }
    assert(button('Add question').disabled,'Existing ten-question maximum retained'); await editorLayout();
    cards()[2].querySelector('input').scrollIntoView({block:'center'}); await pause(); await editorLayout();
    const target=cards()[2].querySelector('input'); target.focus(); await key('Tab');
    assert(document.activeElement.id==='assessment-option-2-0','Natural keyboard field order');
    assert(document.activeElement.getBoundingClientRect().top>=0,'Focused input visible');
    await capture('assessment-ten-questions');
    // An existing single-question fixture tests rendering without relaxing new-draft server validation (3-10).
    button('All assessments').click(); await until(()=>document.querySelector('#assessment-management-panel-drafts button'),'Assessment library'); document.querySelector('#assessment-management-panel-drafts button').click(); await until(()=>button('Edit draft'),'Existing draft review');button('Edit draft').click(); await until(()=>cards().length===1,'Single-question existing draft renders');await editorLayout();
    assert(cards()[0].querySelectorAll('button')[2].disabled,'Minimum question removal limit unchanged');
    await go('/admin/study-sets'); await until(()=>document.querySelector('.study-review-toolbar'),'Study review hierarchy');layout();
    await go('/admin/trust-activity');await until(()=>document.querySelector('.trust-table'),'Trust functionality');layout();
    actor=moderator;await bridge.auth.login('moderator@example.test','SyntheticFixture1!');await until(()=>bridge.auth.user?.role==='moderator','Moderator');await go('/moderator');await until(()=>document.querySelector('.dashboard-kpi-value')?.textContent==='3','Moderator overview');await navigation();layout();
    bridge.navigate('/admin/disputes');await until(()=>location.pathname==='/moderator','Moderator cannot enter admin route');
    actor=student;await bridge.auth.login('student@example.test','SyntheticFixture1!');await until(()=>bridge.auth.user?.role==='student','Student');await go('/sessions');await until(()=>document.querySelector('.student-session-filters'),'Student filters');
    if(innerWidth>1024){const groups=[...document.querySelectorAll('.student-session-filters>.session-filter-group')].map(el=>el.getBoundingClientRect());assert(Math.abs(groups[0].top+groups[0].height/2-groups[1].top-groups[1].height/2)<2,'Status stays on desktop first row');}layout();
  }
  document.getElementById('result').textContent='PASS: Phase C.1 real Chrome layout, assessment editor and navigation checks\n'+JSON.stringify(observations);
} catch(error) { document.getElementById('result').textContent='FAIL: '+error.message+'\n'+error.stack; }
