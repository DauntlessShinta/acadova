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
let _createdDraft = null; let profilePatch = null; let directoryRows = [{ ...student, _id: '507f1f77bcf86cd799439016', name: 'Alexandra Long Student Name', email: 'long.academic.account.address.for.wrapping@example.test', createdAt: '2026-10-01', failedLoginAttempts: 4 }, moderator, admin]; let conversations = [];
const publicPeer = { _id: peer._id, name: peer.name, role: 'student', skillsToTeach: peer.skillsToTeach, skillsToLearn: ['Database'], bio: 'I enjoy sharing Java and Python through collaborative learning.', university: 'Synthetic University', yearLevel: '3rd year', languages: ['English', 'Filipino'], rating: 4.5, ratingCount: 2, weeklyAvailability: { timezone: 'Asia/Manila', ranges: [{ day: 1, start: '09:00', end: '12:00' }] } }; let actor = admin; let _releaseSearch; let delayed = ''; let analyticsCount = 12; let failure = ''; let activeAnalytics = 0; let maxAnalytics = 0;
const calls = []; const writes = []; const response = (data, status = 200, extras = {}) => new Response(JSON.stringify({ success: status < 400, data, ...extras }), { status });
window.fetch = async (url, options = {}) => {
  const parsed = new URL(String(url), location.origin); const path = parsed.pathname; const query = parsed.searchParams; calls.push({ path, q: query.get('q'), from: query.get('from'), page: query.get('page') });
  if (options.body) writes.push({ path, body: JSON.parse(options.body) });
  if (path === '/api/auth/login') return response({ token: 'b1-fixture-' + actor.role, user: actor });
  if (path === '/api/users/me' && options.method === 'PATCH') { profilePatch = JSON.parse(options.body); actor = { ...actor, ...profilePatch }; return response(actor); }
  if (path === '/api/users/me') return response(actor);
  if (path === `/api/users/${peer._id}`) return response(publicPeer);
  if (path === `/api/users/${student._id}`) return response({ _id: student._id, name: actor.name, role: 'student', skillsToTeach: [], rating: null, ratingCount: 0 });
  if (path === `/api/users/${peer._id}/reviews`) return response([{ id: 'visible-review', reviewerName: 'Student reviewer', rating: 5, comment: 'Clear and helpful explanations.' }]);
  if (path === `/api/users/${student._id}/reviews`) return response([]);
  if (path === '/api/credits/rules') return response({ tutoringSessionCost: 20 });
  if (path === '/api/sessions' && options.method === 'POST') return response({ _id: '507f1f77bcf86cd799439099', subject: JSON.parse(options.body).subject, status: 'pending', creditAmount: 20 });
  if (path === '/api/sessions') return response(conversations);
  if (/^\/api\/admin\/users\/[^/]+\/(role|status)$/.test(path) && options.body) { const id=path.split('/')[4], body=JSON.parse(options.body); directoryRows=directoryRows.map(row=>row._id===id?{...row,...(body.role?{role:body.role}:{suspendedAt:body.status==='suspended'?'2026-10-13':null})}:row);return response(directoryRows.find(row=>row._id===id)); }
  if (path === '/api/admin/users') { const rows=directoryRows.filter(row=>(!query.get('role')||row.role===query.get('role'))&&(!query.get('q')||row.name.toLowerCase().includes(query.get('q').toLowerCase())));const page=Number(query.get('page')||1);return response(page===1?rows:[],200,{pagination:{page,total:rows.length,pages:2}}); }

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
    const body = JSON.parse(options.body); _createdDraft = body;
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
const fill = (selector, value) => { const element = document.querySelector(selector); assert(element, 'Missing ' + selector); Object.getOwnPropertyDescriptor(element.tagName === 'SELECT' ? HTMLSelectElement.prototype : element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); };
const go = async path => { bridge.navigate(path); await until(() => bridge.location.pathname === (path.startsWith('/admin/audit-logs') || path.startsWith('/admin/security') ? '/admin/trust-activity' : path.split('?')[0]), 'Navigate ' + path); await pause(100); };




const before = new URLSearchParams(location.search).get('capture') === '/before';
const observations=[];
const key = async value => { window.__acadovaKey=value;await until(()=>!window.__acadovaKey,'Native key');await pause(); };
const capture=async name=>{document.querySelectorAll('.app-toast button').forEach(el=>el.click());window.scrollTo({top:0,behavior:'instant'});await pause(100);if(!window.__acadovaCaptureEnabled)return;window.__acadovaCapture=(before?'before-':'after-')+name;await until(()=>!window.__acadovaCapture,'Screenshot '+name);};
const layout=label=>{assert(document.documentElement.scrollWidth<=innerWidth+1,'No document overflow: '+label);observations.push({page:label,viewport:[innerWidth,innerHeight],scrollWidth:document.documentElement.scrollWidth,scale:visualViewport.scale});};
localStorage.setItem('acadova_token','c2-synthetic-fixture');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge/><App/></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try{
 await until(()=>bridge?.auth.isAuthenticated,'Authenticated');await go('/admin/users');await until(()=>document.querySelectorAll('tbody tr').length===3,'Directory loaded');await capture('admin-users');
 if(!before){layout('Admin Users');const table=document.querySelector('.admin-user-table');assert(table.querySelectorAll('thead th').length===5,'Five essential columns');if(innerWidth>1024)assert(table.getBoundingClientRect().right<=document.querySelector('.table-responsive').getBoundingClientRect().right+1,'All desktop columns fit');
 assert(document.querySelector('.user-directory-page p[role=status]').textContent.includes('accounts · Page 1'),'Readable separator');
 for(const badge of table.querySelectorAll('.badge')) assert(badge.getBoundingClientRect().right<=badge.closest('td').getBoundingClientRect().right+1,'Role badges stay inside their columns');
 const detail=document.querySelector('.account-detail-disclosure');detail.querySelector('summary').focus();await key('Enter');assert(detail.open&&detail.textContent.includes('4 recent failures')&&detail.textContent.includes('Joined'),'Security verification and joining date retained');
 const trigger=document.querySelector('.user-actions-trigger');trigger.focus();await key('Enter');await until(()=>document.querySelector('[role=dialog]'),'Actions dialog');const dialog=document.querySelector('[role=dialog]').getBoundingClientRect();assert(dialog.left>=0&&dialog.right<=innerWidth&&dialog.top>=0&&dialog.bottom<=innerHeight+1,'Actions inside viewport');await key('Escape');await until(()=>!document.querySelector('[role=dialog]'),'Actions closed');assert(document.activeElement===trigger,'Actions restores focus');
 assert(![...document.querySelectorAll('tbody tr')].find(row=>row.textContent.includes('Administrator')).querySelector('.user-actions-trigger'),'Administrators protected');
 trigger.click();await until(()=>button('Promote to Moderator'),'Actions choice');button('Promote to Moderator').click();await until(()=>button('Cancel'),'Role confirmation');assert(!writes.some(row=>row.path.endsWith('/role')),'No role write before confirmation');button('Cancel').click();await until(()=>!document.querySelector('[role=dialog]'),'Cancelled role change');
 trigger.click();await until(()=>button('Promote to Moderator'),'Actions choice');button('Promote to Moderator').click();await until(()=>button('Cancel'),'Role confirmation again');[...document.querySelectorAll('[role=dialog] button')].find(el=>el.textContent.trim()==='Promote to Moderator').click();await until(()=>writes.some(row=>row.path.endsWith('/role')),'Confirmed role write');await until(()=>!document.querySelector('[role=dialog]')&&!document.querySelector('.user-actions-trigger').disabled,'Update finished');
 fill('input[type=search]','Alexandra');await until(()=>document.querySelectorAll('tbody tr').length===1,'Server search');button('Clear filters').click();await until(()=>document.querySelectorAll('tbody tr').length===3,'Clear query');button('Next').click();await until(()=>location.search.includes('page=2'),'Server pagination');button('Previous').click();await until(()=>document.querySelectorAll('tbody tr').length===3,'Return page');layout('Directory interactions');
 }
 actor=student;await bridge.auth.login('student@example.test','SyntheticFixture1!');await until(()=>bridge.auth.user?.role==='student','Student');await go('/tutors/'+peer._id);await until(()=>document.querySelector('main h1')?.textContent===peer.name,'Public profile');await capture('public-profile');
 if(!before){layout('Public profile');assert(document.querySelectorAll('.public-profile-hero [role=tab]').length===4,'Four functional tabs');assert(!document.querySelector('main').textContent.includes('example.test'),'No public email');
 document.getElementById('public-profile-tab-about').focus();await key('ArrowRight');assert(document.getElementById('public-profile-tab-subjects').getAttribute('aria-selected')==='true','Keyboard tab selection');assert(document.querySelector('.public-subject-list').textContent.includes('Java'),'Actual teaching subjects');button('Reviews').click();await until(()=>document.querySelector('.peer-reviews').textContent.includes('Clear and helpful'),'Visible review');button('Availability').click();assert(document.querySelector('#public-profile-panel-availability').textContent.includes('09:00'),'Actual availability');button('About').click();
 button('Message').click();await until(()=>document.activeElement.id==='requestMessage','Message reuses optional request message');fill('#requestMessage','Synthetic tutoring request message');fill('#scheduledAt','2099-10-15T06:00');button('Send Session Request').click();await until(()=>document.querySelector('.session-request-success'),'Request created');const request=writes.find(row=>row.path==='/api/sessions');assert(request.body.meetingMethod==='online'&&request.body.subject==='Java'&&!('creditAmount'in request.body),'Existing online request and server credits');assert(bridge.auth.user.credits===100,'Request does not award credits');
 await go('/profile');await until(()=>document.getElementById('profile-university'),'Owner editor');fill('#profile-university','New synthetic school');fill('#profile-year-level','2nd year');document.querySelector('.profile-language-picker summary').click();fill('#profile-language-search','Fil');const check=[...document.querySelectorAll('.profile-language-options label')].find(el=>el.textContent==='Filipino').querySelector('input');check.click();assert(!document.querySelector('.profile-visibility input').checked,'New details default private');button('Save Profile Changes').click();await until(()=>profilePatch,'Owner update');assert(profilePatch.university==='New synthetic school'&&profilePatch.languages.includes('Filipino')&&profilePatch.profileVisibility.university===false,'Values save with private default');await until(()=>button('Save Profile Changes')?.disabled===false,'Save finished');
 await go('/tutors/'+student._id);await until(()=>document.querySelector('.public-profile-actions a[href="/profile"]'),'Own public view');assert(!button('Request Session')&&!button('Message'),'No self request');layout('Self profile');
 bridge.navigate('/admin/users');await until(()=>location.pathname==='/dashboard','Student denied admin shell');
 }
 document.getElementById('result').textContent='PASS: C.2 Chrome directory/profile/actions/keyboard/owner fields/request checks\n'+JSON.stringify(observations);
}catch(error){document.getElementById('result').textContent='FAIL: '+error.message+' | '+location.pathname+' | '+document.querySelector('main')?.textContent.slice(-600)+'\n'+error.stack;}
