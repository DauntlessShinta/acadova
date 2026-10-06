// Actual routed React app/providers/CSS; every fetch is an in-memory fixture.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import api from '../src/services/api';
import '../src/index.css';

const capturePath = new URLSearchParams(window.location.search).get('capture') || '/admin/users';
const student = { _id: 'me', name: 'Alex Santos', email: 'alex@example.test', role: 'student', credits: 100,
  emailVerified: true, rating: null, ratingCount: 0, onboardingFinishedAt: '2026-10-01', skillsToLearn: ['Java'], skillsToTeach: ['Math'] };
let peer = { ...student, _id: 'peer', name: 'Nathan Santos', skillsToTeach: ['Java'], suspendedAt: null };
const topic = { id: 'topic', name: 'Java', description: 'Learn Java basics.', status: 'published' };
const resource = { id: 'r', topic: topic.id, title: 'Java basics', description: 'Read a short explanation.', resourceType: 'text', textContent: 'A useful Java lesson.', reviewStatus: 'published', creditCost: 0 };
const module = { id: 'module', topic: topic.id, title: 'Java module', description: 'Study Java in order.', status: 'published', resources: [resource], unavailableResourceCount: 1, creditCost: 0, locked: false };
const questions = Array.from({ length: 3 }, (_, i) => ({ prompt: `Choose the right answer for question ${i + 1}`, options: ['First', 'Second'] }));
const assessment = { id: 'a', title: 'Java check', topic: 'Java', questionCount: 3, passingScore: 60, questions };
const session = { _id: 's', subject: 'Java tutoring', learner: student, tutor: peer, status: 'disputed', meetingMethod: 'online',
  creditAmount: 20, scheduledAt: new Date().toISOString(), reviewIndicators: ['prior_credit_transaction'], disputeReason: 'Please review the recorded evidence.' };
const rules = { startingCreditGrant: 100, tutoringSessionCost: 20, assessmentReward: 20, version: 1 };
let current = student; let failure = ''; let statusWrites = 0; let roleWrites = 0;
let releaseSuspension; let releaseRequest; let delayRequest = false; let requestWrites = 0; let publicationWrites = 0; let cancellationWrites = 0;
let roomSession = { ...session, status: 'scheduled', meetingLink: 'https://example.com/meeting' };
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify({ success: status < 400, data, ...extra }), { status });
window.fetch = async (url, options = {}) => {
  const route = new URL(String(url), 'https://fixture.test').pathname;
  if (options.method === 'POST' && route.endsWith('/publish')) { publicationWrites++; return json({}); }
  if (options.method === 'POST' && route === '/api/sessions') {
    requestWrites++;
    if (delayRequest) return new Promise((resolve) => { releaseRequest = () => resolve(json({ _id: 's', status: 'pending' }, 201)); });
    return json({ _id: 's', status: 'pending' }, 201);
  }
  if (options.method === 'PATCH' && route === '/api/sessions/s/status') { cancellationWrites++; roomSession = { ...roomSession, status: JSON.parse(options.body).status }; return json(roomSession); }
  if (route === '/api/sessions/s') return json(roomSession);
  if (route === failure) return json(null, 503, { message: 'Fixture service unavailable.' });
  if (route === '/api/test-delayed-suspended') return new Promise((resolve) => { releaseSuspension = () => resolve(json(null, 403, { code: 'ACCOUNT_SUSPENDED' })); });
  if (route === '/api/test-suspended') return json(null, 403, { code: 'ACCOUNT_SUSPENDED', message: 'Account is suspended' });
  if (route === '/api/test-forbidden') return json(null, 403, { message: 'Ordinary forbidden access' });
  if (route === '/api/admin/users/peer/role') { roleWrites++; return json(null, 409, { message: 'Active Sessions must be completed, cancelled, or resolved before promoting this Student to Moderator.' }); }
  if (route === '/api/admin/users/peer/status') { statusWrites++; const body = JSON.parse(options.body); peer = { ...peer, suspendedAt: body.status === 'suspended' ? new Date().toISOString() : null }; return json(peer); }
  let data = [];
  if (route === '/api/sessions') data = [roomSession];
  if (route === '/api/users/me') data = current;
  if (route === '/api/users/tutors') data = [peer];
  if (route === '/api/users/peer') data = peer;
  if (route === '/api/learning/topics') data = [topic];
  if (route === '/api/learning/topics/topic') data = { ...topic, resources: [resource], modules: [module], assessments: [assessment] };
  if (route === '/api/learning/modules/module') data = module;
  if (route === '/api/learning/resources/r') data = resource;
  if (route === '/api/assessments' || route === '/api/moderator/assessments') data = [assessment];
  if (route === '/api/assessments/a') data = assessment;
  if (route === '/api/moderator/assessments/a') data = { ...assessment, status: 'draft', questions: questions.map((question) => ({ ...question, correctIndex: 0 })) };
  if (route === '/api/moderator/learning/topics') data = [topic, { ...topic, id: 'draft-topic', name: 'Topic draft', status: 'draft' }];
  if (route === '/api/moderator/learning/resources') data = [resource, { ...resource, id: 'submitted', title: 'Resource draft', reviewStatus: 'submitted' }];
  if (route === '/api/moderator/learning/modules') data = [{ ...module, id: 'draft-module', title: 'Module draft', status: 'draft', resources: ['r'] }];
  if (route === '/api/moderator/sessions/disputed') data = [session];
  if (route === '/api/admin/users') data = [student, peer];
  if (route === '/api/admin/credits/rules' || route === '/api/credits/rules') data = rules;
  if (route === '/api/admin/security') data = { counts: { cooldownStarted: 0, cooldownExtended: 0, activeCooldowns: 0, recoveredLogins: 0, suspendedAttempts: 0 }, events: [] };
  if (route === '/api/notifications/unread-count') data = { count: 0 };
  if (route === '/api/analytics/sessions') data = { total: 0, byStatus: {} };
  if (route === '/api/analytics/ratings') data = { totalRatings: 0, averageRating: null, distribution: [] };
  if (route === '/api/analytics/credits') data = { totalTransactions: 0, breakdown: {} };
  return json(data, 200, { pagination: { page: 1, limit: 25, total: 0 }, summary: { recordedEarned: 0, recordedSpent: 0 } });
};
const root = createRoot(document.getElementById('root')); let renderKey = 0;
const pause = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (value, label) => { if (!value) throw new Error(label); };
const until = async (check, label) => { for (let i = 0; i < 150; i++) { if (check()) return; await pause(); } throw new Error(label); };
const visible = (selector) => [...document.querySelectorAll(selector)].filter((element) => element.getClientRects().length && !element.closest('details:not([open])'));
const fill = (selector, value) => { const field = document.querySelector(selector); Object.getOwnPropertyDescriptor(field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })); };
// oxlint-disable-next-line react/only-export-components
function Probe() { const location = useLocation(); const navigate = useNavigate(); return <span hidden id="probe" data-url={location.pathname + location.search + location.hash}><button id="back" onClick={() => navigate(-1)}>Back</button><button id="forward" onClick={() => navigate(1)}>Forward</button></span>; }
async function render(path, user = student) {
  current = user; const previous = document.getElementById('probe');
  renderKey++;
  if (user) localStorage.setItem('acadova_token', `fixture-${renderKey}`);
  else { localStorage.removeItem('acadova_token'); localStorage.removeItem('acadova_user'); }
  window.history.replaceState({}, '', path);
  root.render(<BrowserRouter key={renderKey}><AuthProvider><ToastProvider><ConfirmProvider><App /><Probe /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
  await until(() => document.getElementById('probe') !== previous && (document.getElementById('probe')?.dataset.url === path || (path === '/learning?continue=1' && document.getElementById('probe')?.dataset.url.startsWith('/learning?topic='))), 'Router commit: ' + path);
  await until(() => document.querySelector('#main-content h1, .auth-form-panel h2, .auth-form h2, #login-email, .onboarding h1, .landing-page h1'), 'Loaded route: ' + path);
  await pause(100);
}
const cancelDialog = async () => { [...document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent === 'Cancel').click(); await until(() => !document.querySelector('[role="dialog"]'), 'Dialog cancellation'); };
const acceptDialog = async (label) => { [...document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent === label).click(); await until(() => !document.querySelector('[role="dialog"]'), 'Dialog completion'); };
const errors = []; const checks = [];
window.addEventListener('error', (event) => errors.push(event.message)); window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason)));
try {
  assert(window.visualViewport.scale === 1 && devicePixelRatio === 1, '100% zoom/scale baseline');
  for (const role of ['student', 'moderator', 'admin']) {
    await render(role === 'student' ? '/profile' : '/' + role, { ...student, role });
    if (role === 'student') {
      assert(document.querySelector('label[for="profile-skills-teach"]') && document.querySelector('#profile-skills-teach').maxLength === 50, 'Teach skill label/limit');
      assert(document.querySelector('label[for="profile-skills-learn"]'), 'Learn skill label');
    } else {
      assert((getComputedStyle(document.querySelector('.staff-sidebar')).display !== 'none') === (innerWidth > 1024), 'Staff sidebar determined by width, not height');
      assert((getComputedStyle(document.querySelector('.staff-menu-button')).display === 'none') === (innerWidth > 1024), 'Staff hamburger width policy');
    }
    const trigger = visible('.account-trigger')[0]; assert(trigger, 'Visible account disclosure: ' + role);
    trigger.scrollIntoView({ block: 'nearest' }); trigger.click(); await until(() => visible('.account-actions').length, 'Account menu');
    await until(() => { const bounds = visible('.account-actions')[0]?.getBoundingClientRect(); return bounds && bounds.top >= 0 && bounds.bottom <= innerHeight; }, 'Account actions reachable inside viewport: ' + role);
    assert(visible('.account-actions a').length === (role === 'student' ? 1 : 0), 'Role-appropriate Profile link');
    const tokenBefore = localStorage.getItem('acadova_token');
    visible('.account-actions button')[0].click(); await until(() => document.querySelector('[role="dialog"]'), 'Sign out dialog');
    assert(document.querySelector('[role="dialog"]').textContent.includes('Sign out of Acadova?'), 'Shared sign-out title');
    assert(document.querySelector('[role="dialog"]').textContent.includes("You'll need to sign in again"), 'Shared sign-out message');
    await acceptDialog('Stay signed in'); assert(localStorage.getItem('acadova_token') === tokenBefore, 'Cancel leaves auth intact: ' + role);
    visible('.account-actions button')[0].click(); await until(() => document.querySelector('[role="dialog"]'), 'Sign out again');
    await acceptDialog('Sign out'); await until(() => document.querySelector('#login-email'), 'Confirmed logout: ' + role);
    assert(!localStorage.getItem('acadova_token'), 'Confirm clears token: ' + role);
  }
  checks.push('Visible account for all roles; shared sign-out Cancel/Confirm; no fake staff Profile; skill labels/50-character limit; desktop navigation at short height');
  await render('/tutors'); assert(visible('#tutor-search').length === 1 && !visible('.discovery-search').length, 'One prominent Tutor search');
  await until(() => document.querySelector('.peer-card button'), 'Tutor request button'); document.querySelector('.peer-card button').click();
  await until(() => document.querySelector('#scheduledAt'), 'Request modal');
  fill('#scheduledAt', '2099-10-08T12:00'); fill('#requestMessage', 'Help me understand Java arrays.'); await pause();
  const requestForm = document.querySelector('#scheduledAt').closest('form'); delayRequest = true; const before = requestWrites;
  requestForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  requestForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => releaseRequest, 'Request pending'); assert(requestWrites === before + 1, 'Repeated submit creates one call');
  assert(requestForm.querySelector('[type="submit"]').disabled, 'Request submit disabled');
  releaseRequest(); delayRequest = false; await until(() => document.querySelector('.session-request-success'), 'Request success state');
  assert(!document.querySelector('#scheduledAt') && document.querySelector('.session-request-success a').getAttribute('href') === '/sessions/s', 'Success replaces form and links to Session');
  await render('/tutors/peer'); fill('#scheduledAt', '2099-10-15T12:00'); fill('#requestMessage', 'Help with Java again.'); await pause();
  const profileForm = document.querySelector('#request-session form'); const profileBefore = requestWrites;
  profileForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); profileForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => document.querySelector('.session-request-success'), 'Profile request success'); assert(requestWrites === profileBefore + 1 && !document.querySelector('#request-session form'), 'Profile submit guard');
  checks.push('Find Tutors has one search and Quick Filters; discovery/profile repeated-submit guards and success destination');
  await render('/learning?topic=topic'); await until(() => document.querySelector('.learning-module-summary button'), 'Query topic load');
  document.querySelector('.learning-module-summary button').click(); await until(() => document.querySelector('.learning-content-detail'), 'Module query load');
  assert(document.getElementById('probe').dataset.url.includes('module=module'), 'Module URL');
  document.getElementById('back').click(); await until(() => document.querySelector('.learning-module-summary button'), 'Learning history Back');
  document.getElementById('forward').click(); await until(() => document.querySelector('.learning-content-detail'), 'Learning history Forward');
  document.querySelector('.learning-breadcrumbs button').click(); await until(() => document.querySelector('.learning-topic-results'), 'Learning library clears state');
  assert(document.getElementById('probe').dataset.url === '/learning', 'Library URL clears parameters');
  document.getElementById('back').click(); await until(() => document.querySelector('.learning-content-detail'), 'Back restores module after library');
  document.querySelectorAll('.learning-breadcrumbs button')[1].click(); await until(() => document.querySelector('.learning-resource-list button'), 'Topic breadcrumb');
  document.querySelector('.learning-resource-list button').click(); await until(() => document.querySelector('.learning-content-detail'), 'Resource query load');
  assert(document.getElementById('probe').dataset.url.includes('resource=r'), 'Resource URL');
  await render('/learning?continue=1'); await until(() => document.querySelector('.learning-module-layout'), 'Continue rehydrates query');
  assert(!document.getElementById('probe').dataset.url.includes('continue') && document.getElementById('probe').dataset.url.includes('module=module'), 'Continue resolves to truthful canonical query');
  document.getElementById('learning-tab-contribute').click(); await until(() => visible('#learning-panel-contribute').length, 'Contribution view');
  assert(document.getElementById('probe').dataset.url.includes('view=contribute') && document.querySelector('.learning-page-header h1').textContent === 'Share a resource', 'Contribution query/heading');
  document.getElementById('back').click(); await until(() => visible('#learning-panel-library').length && document.querySelector('.learning-module-layout'), 'Contribution Back restores library context');
  document.getElementById('forward').click(); await until(() => visible('#learning-panel-contribute').length, 'Contribution Forward');
  visible('a[href="/learning"]')[0].click(); await until(() => document.querySelector('.learning-topic-results'), 'Learning navigation returns to library');
  assert(document.getElementById('probe').dataset.url === '/learning' && visible('#learning-panel-library').length, 'Learning route clears contribution and detail context');
  checks.push('Learning topic/module/resource URL, same-route query updates, library removal, Back/Forward and Continue');
  await render('/sessions/s'); await until(() => document.querySelector('.session-cancel-action'), 'Scheduled cancellation available');
  document.querySelector('.session-secondary-actions').open = true; document.querySelector('.session-cancel-action').click(); await until(() => document.querySelector('[role="dialog"]'), 'Cancellation dialog');
  assert(document.querySelector('[role="dialog"]').textContent.includes('Cancel this session?'), 'Cancellation title');
  await cancelDialog(); assert(cancellationWrites === 0, 'Cancelled dialog writes nothing');
  document.querySelector('.session-cancel-action').click(); await until(() => document.querySelector('[role="dialog"]'), 'Cancellation repeat');
  await acceptDialog('Cancel Session'); await until(() => !document.querySelector('.session-cancel-action'), 'Cancelled state removes action');
  document.getElementById('room-tab-progress').click(); await pause(); assert(document.querySelector('.session-progress').textContent.includes('Not applicable') && !document.querySelector('.session-progress').textContent.includes('Not yet complete'), 'Terminal Progress wording');
  roomSession = { ...roomSession, status: 'scheduled', learnerCheckedInAt: new Date().toISOString() };
  await render('/sessions/s'); assert(!document.querySelector('.session-cancel-action'), 'First check-in removes pre-start cancellation');
  delete roomSession.learnerCheckedInAt;
  checks.push('Scheduled cancellation confirmation, Cancel/Confirm, first check-in cutoff and terminal Progress');
  for (const [section, kind] of [['topics', 'topic'], ['resources', 'resource'], ['modules', 'module']]) {
    await render(`/admin/learning#manage-panel-${section}`, { ...student, role: 'admin' });
    await until(() => visible(`#manage-panel-${section} button`).some((button) => button.textContent === 'Publish'), 'Publication button');
    assert(document.querySelector('.staff-eyebrow').textContent.includes('Administration'), 'Admin Learning context');
    assert(!visible(`#manage-panel-${section} form`).length, 'Inactive editor disclosed');
    const button = visible(`#manage-panel-${section} button`).find((node) => node.textContent === 'Publish'); const count = publicationWrites;
    button.click(); await until(() => document.querySelector('[role="dialog"]'), 'Publication confirmation');
    assert(document.querySelector('[role="dialog"]').textContent.includes('Students'), 'Publication audience');
    await cancelDialog(); assert(publicationWrites === count, 'Publication Cancel');
    button.click(); await until(() => document.querySelector('[role="dialog"]'), 'Publication confirmation again'); await acceptDialog('Publish ' + kind);
    await until(() => publicationWrites === count + 1, 'One publication mutation');
  }
  await render('/admin/assessments', { ...student, role: 'admin' });
  await until(() => document.querySelector('#assessment-management-panel-drafts button'), 'Assessment library');
  assert(document.querySelector('.staff-eyebrow').textContent.includes('Administration') && document.querySelector('#assessment-management-tab-drafts').textContent === 'All assessments', 'Assessment context/library label');
  document.querySelector('#assessment-management-panel-drafts button').click();
  await until(() => visible('#assessment-management-panel-review .btn-primary').length, 'Assessment review');
  visible('#assessment-management-panel-review .btn-primary')[0].click(); await until(() => document.querySelector('[role="dialog"]'), 'Assessment publish dialog');
  const assessmentBefore = publicationWrites; await cancelDialog(); assert(publicationWrites === assessmentBefore, 'Assessment publish Cancel');
  visible('#assessment-management-panel-review .btn-primary')[0].click(); await until(() => document.querySelector('[role="dialog"]'), 'Assessment republish dialog');
  await acceptDialog('Publish assessment'); await until(() => publicationWrites === assessmentBefore + 1, 'Assessment publish Confirm');
  failure = '/api/moderator/learning/resources'; await render('/moderator', { ...student, role: 'moderator' });
  await until(() => document.querySelector('.staff-queue-summary')?.textContent.includes('Unavailable'), 'Queue source unavailable'); failure = '';
  failure = '/api/notifications'; await render('/dashboard'); visible('.notification-trigger')[0].click();
  await until(() => document.querySelector('.notification-panel')?.textContent.includes('unavailable'), 'Notification unavailable state');
  assert(!document.querySelector('.notification-panel').textContent.includes('No notifications yet'), 'Notification error is not empty truth'); failure = '';
  checks.push('Topic/Resource/Module shared publication Cancel/Confirm, Admin context, editor disclosure, unavailable queue and notification truth');
  for (const path of ['/tutors', '/tutors/peer', '/profile']) {
    await render(path); await until(() => document.body.textContent.includes('No ratings yet'), 'Unrated presentation: ' + path);
    assert(!document.querySelector('.peer-rating .star-rating'), 'Unrated peer has stars');
    assert(document.documentElement.scrollWidth <= innerWidth, 'Unrated page overflow');
  }
  peer = { ...peer, rating: 4, ratingCount: 1 }; await render('/tutors/peer');
  await until(() => document.body.textContent.includes('4.0 out of 5 · 1 review'), 'Rated profile');
  assert(document.querySelector('.peer-rating [role="img"]'), 'Accessible read-only reputation');
  peer = { ...peer, rating: null, ratingCount: 0 };
  fill('#scheduledAt', '2020-01-01T12:00'); fill('#requestMessage', 'Please help with Java.'); await pause();
  document.querySelector('#request-session form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => document.querySelector('#request-time-error'), 'Past time inline error'); assert(document.activeElement.id === 'scheduledAt', 'Past time focus');
  await render('/assessments'); await until(() => document.querySelector('.assessment-list button'), 'Assessment list'); document.querySelector('.assessment-list button').click();
  await until(() => document.querySelector('input[name="question-0"]'), 'Assessment questions');
  document.querySelector('fieldset').closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await pause();
  assert(document.activeElement.name === 'question-0' && document.querySelector('fieldset').getAttribute('aria-describedby') === 'assessment-answer-error', 'Unanswered question focus/description');
  await render('/learning'); await until(() => document.querySelector('.learning-topic-results button'), 'Learning topic'); document.querySelector('.learning-topic-results button').click();
  await until(() => document.querySelector('.learning-module-summary button'), 'Module list'); document.querySelector('.learning-module-summary button').click();
  await until(() => document.body.textContent.includes('Some resources in this module are no longer available'), 'Archived resource explanation');
  checks.push('Unrated/rated discovery/profile, past request focus, assessment validation focus and unavailable module materials');
  for (const role of ['moderator', 'admin']) {
    for (const section of ['topics', 'resources', 'modules']) {
      await render(`/${role}/learning#manage-panel-${section}`, { ...student, role });
      await until(() => visible(`#manage-panel-${section}`).length, 'Staff deep link: ' + section);
      assert(visible('[id^="manage-panel-"]').length === 1, 'Only intended Learning tab');
    }
    document.getElementById('manage-tab-resources').click(); await pause(); document.getElementById('manage-tab-topics').click(); await pause();
    document.getElementById('back').click(); await until(() => visible('#manage-panel-resources').length, 'Learning back');
    document.getElementById('forward').click(); await until(() => visible('#manage-panel-topics').length, 'Learning forward');
  }
  await render('/moderator', { ...student, role: 'moderator' });
  await until(() => document.querySelector('a[href="/moderator/learning#manage-panel-resources"]'), 'Canonical queue links');
  document.querySelector('a[href="/moderator/learning#manage-panel-resources"]').click(); await until(() => visible('#manage-panel-resources').length, 'Queue opens Resources');
  await render('/moderator/disputes', { ...student, role: 'moderator' }); await until(() => document.querySelector('.session-dispute-actions button'), 'Dispute evidence');
  assert([...document.querySelectorAll('.session-dispute-actions button')].every((button) => button.disabled), 'Prior-payment resolution must appear blocked');
  for (const path of ['/moderator/reviews', '/moderator/assessments', '/admin/sessions', '/admin/analytics', '/admin/credits', '/admin/audit-logs', '/admin/security', '/admin/moderation']) {
    await render(path, { ...student, role: path.startsWith('/admin') ? 'admin' : 'moderator' });
    assert(document.documentElement.scrollWidth <= innerWidth, 'Staff overflow: ' + path);
    assert(document.querySelector('.staff-content h1'), 'Staff heading: ' + path);
  }
  await render('/admin/users', { ...student, role: 'admin' }); await until(() => document.querySelectorAll('tbody tr').length === 2, 'Users loaded');
  const peerRow = () => [...document.querySelectorAll('tbody tr')].find((row) => row.textContent.includes('Nathan Santos'));
  peerRow().querySelector('button').click(); await until(() => document.querySelector('[role="dialog"]'), 'Promotion confirmation');
  await acceptDialog('Promote to Moderator'); await until(() => document.body.textContent.includes('Active Sessions must be completed'), 'Persistent role conflict');
  assert(peerRow().textContent.includes('Student') && roleWrites === 1, 'Blocked role stays Student');
  peerRow().querySelectorAll('button')[1].click(); await until(() => document.querySelector('#confirmation-reason'), 'Suspension reason');
  assert([...document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent === 'Suspend user').disabled, 'Reason required');
  fill('#confirmation-reason', 'Fixture account status review.'); await pause(); await acceptDialog('Suspend user');
  await until(() => peerRow().textContent.includes('Suspended'), 'Suspended row'); assert(statusWrites === 1, 'One status request');
  peerRow().querySelectorAll('button')[1].click(); await until(() => document.querySelector('[role="dialog"]'), 'Reactivation confirmation'); await cancelDialog(); assert(statusWrites === 1, 'Cancel prevents write');
  checks.push('Canonical staff deep links/back-forward/queue, staff routes/tables, blocked dispute and Admin role/status confirmations');
  for (const [path, endpoint, expected] of [
    ['/admin/audit-logs', '/api/admin/audit-logs', 'Audit records are unavailable'],
    ['/admin/security', '/api/admin/security', 'Security activity is unavailable'],
    ['/admin/credits', '/api/admin/credits/rules', 'Credit administration is unavailable'],
    ['/moderator/learning', '/api/moderator/learning/topics', 'Learning management is unavailable'],
    ['/moderator/assessments', '/api/moderator/assessments', 'Assessment drafts are unavailable'],
    ['/learning', '/api/learning/topics', 'Learning topics could not be loaded'],
    ['/assessments', '/api/assessments', 'Assessment list could not be loaded'],
    ['/credits', '/api/credits/mine', 'Credit activity is unavailable'],
  ]) { failure = endpoint; await render(path, { ...student, role: path.startsWith('/admin') ? 'admin' : path.startsWith('/moderator') ? 'moderator' : 'student' }); await until(() => document.body.textContent.includes(expected), 'Honest load failure: ' + path); assert(!document.body.textContent.includes('No matching audit records'), 'Failure presented as no records'); failure = ''; }
  await render('/profile'); const token = localStorage.getItem('acadova_token');
  await api.get('/api/test-forbidden').catch((error) => assert(error.status === 403, 'Generic forbidden'));
  await pause(); assert(localStorage.getItem('acadova_token') === token && document.querySelector('.app-shell-student'), 'Ordinary forbidden cleared auth');
  await api.get('/api/test-suspended').catch((error) => assert(error.data.code === 'ACCOUNT_SUSPENDED', 'Suspension code'));
  await until(() => document.querySelector('#login-email'), 'Suspension redirects to Login');
  assert(!localStorage.getItem('acadova_token') && !localStorage.getItem('acadova_user'), 'Suspension leaves token/user');
  assert(!document.querySelector('.student-sidebar') && document.body.textContent.includes('Your account is suspended'), 'Suspension shell/feedback');
  await pause(200); assert(document.getElementById('probe').dataset.url === '/login', 'No suspension redirect loop');
  await render('/profile');
  const delayed = api.get('/api/test-delayed-suspended').catch(() => {});
  await until(() => releaseSuspension, 'Delayed old response');
  await render('/profile'); const newToken = localStorage.getItem('acadova_token');
  releaseSuspension(); await delayed; await pause();
  assert(localStorage.getItem('acadova_token') === newToken && document.querySelector('.app-shell-student'), 'Old suspension response cleared a newer session');
  checks.push('Honest staff API failure states and real AuthProvider suspension recovery without generic-403 logout');
  await render('/admin/users', { ...student, role: 'admin' }); await until(() => document.querySelectorAll('tbody tr').length === 2, 'Capture');
  const tableRegion = document.querySelector('.table-responsive');
  assert(tableRegion.tabIndex === 0 && tableRegion.getAttribute('role') === 'region', 'User table keyboard access');
  assert(document.querySelector('tbody td').getBoundingClientRect().width >= 160, 'User names squeezed into fragments');
  tableRegion.focus(); tableRegion.scrollLeft = tableRegion.scrollWidth; await pause();
  assert([...document.querySelectorAll('tbody tr')].every((row) => row.querySelector('button').getBoundingClientRect().right <= innerWidth), 'User actions not reachable by scrolling');
  tableRegion.scrollLeft = 0;
  assert(document.documentElement.scrollWidth <= innerWidth, 'User table causes page overflow');
  for (const path of ['/dashboard', '/sessions', '/sessions?view=messages', '/credits', '/learning', '/profile', '/tutors', '/tutors/peer', '/sessions/s']) {
    await render(path); assert(document.documentElement.scrollWidth <= innerWidth, 'Student overflow: ' + path);
  }
  for (const path of ['/', '/login', '/register', '/forgot-password', '/reset-password']) {
    await render(path, null); assert(document.documentElement.scrollWidth <= innerWidth, 'Public/auth overflow: ' + path);
  }
  await render('/onboarding', { ...student, onboardingFinishedAt: null, skillsToLearn: [], skillsToTeach: [] }); assert(document.documentElement.scrollWidth <= innerWidth, 'Onboarding overflow');
  checks.push('Representative Student/staff/auth/public/onboarding routes at CSS viewport with scale 1 and fresh default zoom');
  const capture = capturePath;
  await render(capture || '/admin/users', { ...student, role: capture?.startsWith('/moderator') ? 'moderator' : capture?.startsWith('/admin') ? 'admin' : 'student' });
  window.scrollTo({ top: 0, behavior: 'instant' }); await pause();
  assert(errors.length === 0, 'Runtime errors: ' + errors.join('; '));
  document.getElementById('result').textContent = `PASS: ${innerWidth}x${innerHeight} hardening\n${checks.join('\n')}`;
  document.getElementById('result').hidden = true;
} catch (error) { document.getElementById('result').textContent = `FAIL: ${error.message}\n${checks.join('\n')}`; }
