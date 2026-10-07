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
const resource = { id: 'r', topic: topic.id, title: 'Java basics', description: 'Read a short explanation.', resourceType: 'text', textContent: 'A useful Java lesson.', reviewStatus: 'published', creditCost: 0,
  submittedBy: peer._id, submitterName: peer.name, createdAt: '2026-10-01T10:00:00.000Z' };
const module = { id: 'module', topic: topic.id, title: 'Java module', description: 'Study Java in order.', status: 'published', resources: [resource], unavailableResourceCount: 1, creditCost: 0, locked: false };
const questions = Array.from({ length: 3 }, (_, i) => ({ prompt: `Choose the right answer for question ${i + 1}`, options: ['First', 'Second'] }));
const assessment = { id: 'a', title: 'Java check', topic: 'Java', questionCount: 3, passingScore: 60, questions };
const session = { _id: 's', subject: 'Java tutoring', learner: student, tutor: peer, status: 'disputed', meetingMethod: 'online',
  creditAmount: 20, scheduledAt: new Date().toISOString(), reviewIndicators: ['prior_credit_transaction'], disputeReason: 'Please review the recorded evidence.' };
const rules = { startingCreditGrant: 100, tutoringSessionCost: 20, assessmentReward: 20, version: 1 };
let current = student; let failure = ''; let statusWrites = 0; let roleWrites = 0;
let releaseSuspension; let releaseRequest; let delayRequest = false; let requestWrites = 0; let publicationWrites = 0; let cancellationWrites = 0;
let roomSession = { ...session, status: 'scheduled', meetingLink: 'https://example.com/meeting' };
let contributionWrites = 0; let releaseContribution;
let assessmentWrites = 0; let releaseAssessment;
let reviewWrites = 0;
let review = { _id: 'rating', rating: 4, comment: 'Helpful session.', isHidden: false, fromUser: peer, toUser: student,
  session: { subject: 'Java tutoring' }, createdAt: new Date().toISOString() };
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify({ success: status < 400, data, ...extra }), { status });
window.fetch = async (url, options = {}) => {
  const route = new URL(String(url), 'https://fixture.test').pathname;
  if (options.method === 'PATCH' && route === '/api/moderator/ratings/rating/visibility') {
    reviewWrites++; review = { ...review, isHidden: JSON.parse(options.body).hidden }; return json(review);
  }
  if (options.method === 'POST' && route === '/api/assessments/a/submit') {
    assessmentWrites++;
    return new Promise((resolve) => { releaseAssessment = () => resolve(json({ passed: true, score: 100, rewardIssued: true, creditsAwarded: 20 })); });
  }
  if (options.method === 'POST' && route === '/api/learning/resources/submit') {
    contributionWrites++;
    return new Promise((resolve) => { releaseContribution = () => resolve(json({ id: 'submitted', reviewStatus: 'submitted' }, 201)); });
  }
  if (options.method === 'POST' && route.endsWith('/publish')) { publicationWrites++; return json({}); }
  if (options.method === 'POST' && route === '/api/sessions') {
    requestWrites++;
    if (delayRequest) return new Promise((resolve) => { releaseRequest = (status = 201) => resolve(json(
      status === 201 ? { _id: 's', status: 'pending' } : null, status,
      status === 409 ? { message: 'You already have this session request pending.' }
        : status === 503 ? { message: 'Session request could not be created.' } : {})); });
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
  if (route === '/api/moderator/ratings') data = [review];
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
const nativeKey = async (key) => { window.__acadovaKey = key; await until(() => window.__acadovaKey === null, 'Native key: ' + key); };
const nativeDoubleClick = async (control) => {
  control.scrollIntoView({ block: 'center', behavior: 'instant' }); await pause();
  const bounds = control.getBoundingClientRect();
  window.__acadovaPointer = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, double: true };
  await until(() => window.__acadovaPointer === null, 'Native double click');
};
const visible = (selector) => [...document.querySelectorAll(selector)].filter((element) => element.getClientRects().length && (!element.closest('details:not([open])') || element.matches('summary')));
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
  await until(() => document.querySelector('#root h1, .auth-form-panel h2, .auth-form h2, #login-email'), 'Loaded route: ' + path);
  await pause(100);
  for (const control of visible('button, a[href], input:not([type="hidden"]), select, summary')) {
    const box = control.getBoundingClientRect();
    assert(box.width >= 23.9 && box.height >= 23.9, `Target below 24px on ${path}: ${control.id || control.className || control.textContent?.slice(0, 45)} (${box.width}x${box.height})`);
  }
  for (const control of visible('.btn, .workflow-tabs button, .account-trigger, .notification-trigger')) {
    assert(control.getBoundingClientRect().height >= 43.9, 'Important control below 44px: ' + path + ' ' + control.className);
  }
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
    if (role !== 'student' && innerWidth > 1024) {
      const bounds = trigger.getBoundingClientRect();
      assert(bounds.top >= 0 && bounds.bottom <= innerHeight, 'Staff account stays visible before scrolling: ' + role);
    }
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
  await nativeDoubleClick(requestForm.querySelector('[type="submit"]'));
  requestForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  requestForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => releaseRequest, 'Request pending'); assert(requestWrites === before + 1, 'Repeated submit creates one call');
  assert(requestForm.querySelector('[type="submit"]').disabled && requestForm.getAttribute('aria-busy') === 'true', 'Request submit disabled/busy');
  await nativeKey('Escape'); assert(document.querySelector('[role="dialog"]'), 'Pending request cannot be dismissed');
  for (const status of [409, 503]) {
    releaseRequest(status); releaseRequest = null;
    await until(() => !requestForm.querySelector('[type="submit"]').disabled, 'Request controls recover: ' + status);
    assert(requestForm.querySelector('[role="alert"]') && requestForm.getAttribute('aria-busy') === 'false', 'Persistent request failure and cleared busy');
    assert(document.getElementById('requestMessage').value === 'Help me understand Java arrays.', 'Request failure keeps draft');
    requestForm.querySelector('[type="submit"]').focus(); await nativeKey('Enter'); await nativeKey('Enter');
    await until(() => releaseRequest, 'Request retry pending');
  }
  assert(requestWrites === before + 3, 'Exactly one call per attempt including repeated Enter');
  releaseRequest(); releaseRequest = null; delayRequest = false; await until(() => document.querySelector('.session-request-success'), 'Request success state');
  assert(!document.querySelector('#scheduledAt') && document.querySelector('.session-request-success a').getAttribute('href') === '/sessions/s', 'Success replaces form and links to Session');
  await render('/tutors/peer'); fill('#scheduledAt', '2099-10-15T12:00'); fill('#requestMessage', 'Help with Java again.'); await pause();
  const profileForm = document.querySelector('#request-session form'); const profileBefore = requestWrites;
  delayRequest = true; await nativeDoubleClick(profileForm.querySelector('[type="submit"]'));
  profileForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); profileForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => releaseRequest, 'Profile request pending');
  assert(profileForm.querySelector('[type="submit"]').disabled && profileForm.getAttribute('aria-busy') === 'true' && requestWrites === profileBefore + 1, 'Profile pending guard');
  releaseRequest(409); releaseRequest = null;
  await until(() => !profileForm.querySelector('[type="submit"]').disabled, 'Profile conflict recovery');
  assert(profileForm.querySelector('[role="alert"]')?.textContent.includes('already have') && document.getElementById('requestMessage').value === 'Help with Java again.', 'Profile persistent conflict and draft');
  profileForm.querySelector('[type="submit"]').focus(); await nativeKey('Enter'); await nativeKey('Enter');
  await until(() => releaseRequest, 'Profile retry'); releaseRequest(); releaseRequest = null; delayRequest = false;
  await until(() => document.querySelector('.session-request-success'), 'Profile request success'); assert(requestWrites === profileBefore + 2 && !document.querySelector('#request-session form'), 'Profile submit guard and recovery');
  checks.push('Discovery/profile native double-click and repeated Enter; synchronous submit guards; disabled/busy pending; persistent conflicts, failed-request draft and retry recovery; success destination');
  await render('/learning'); await until(() => document.querySelector('.learning-card-action'), 'Whole topic destination');
  const topicCard = document.querySelector('.learning-destination-card');
  assert(topicCard.querySelectorAll('button, a').length === 1, 'Topic has one destination');
  topicCard.querySelector('button').focus();
  assert(getComputedStyle(document.activeElement, '::after').position === 'absolute', 'Whole topic hit surface');
  topicCard.scrollIntoView({ block: 'center', behavior: 'instant' }); await pause();
  const topicBounds = topicCard.getBoundingClientRect();
  assert(document.elementFromPoint(topicBounds.right - 8, topicBounds.bottom - 8)?.closest('button') === topicCard.querySelector('button'), 'Topic corner opens same destination');
  document.getElementById('learning-tab-contribute').click(); await until(() => visible('#learning-panel-contribute').length, 'Contribution form');
  const select = document.getElementById('learning-topic'); select.value = 'topic'; select.dispatchEvent(new Event('change', { bubbles: true }));
  fill('#learning-title', 'Helpful Java resource'); fill('#learning-description', 'A clear Java explanation.'); fill('#learning-text', 'Java study notes for Students.'); await pause();
  const contributionForm = document.querySelector('.learning-contribution form');
  contributionForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  contributionForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => releaseContribution, 'Contribution is pending'); assert(contributionWrites === 1, 'One contribution per repeated submit');
  assert(contributionForm.querySelector('[type="submit"]').disabled, 'Contribution pending target disabled'); releaseContribution();
  await until(() => document.body.textContent.includes('Your resource is awaiting review'), 'Contribution persistent review status');
  assert(document.getElementById('learning-title').value === '', 'Successful contribution clears draft');
  checks.push('Whole topic target and one destination; repeated contribution sends once and shows awaiting-review status');
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
  await render('/assessments'); await until(() => document.querySelector('.assessment-hub-list a[aria-label^="Take assessment"]'), 'Assessment hub'); document.querySelector('.assessment-hub-list a[aria-label^="Take assessment"]').click();
  await until(() => document.querySelector('input[name="question-0"]'), 'Assessment questions');
  document.querySelector('fieldset').closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await pause();
  assert(document.activeElement.name === 'question-0' && document.querySelector('fieldset').getAttribute('aria-describedby') === 'assessment-answer-error', 'Unanswered question focus/description');
  for (let index = 0; index < 3; index++) { document.querySelector(`input[name="question-${index}"]`).click(); await pause(); }
  const assessmentForm = document.querySelector('fieldset').closest('form');
  assessmentForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  assessmentForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => releaseAssessment, 'Assessment pending'); assert(assessmentWrites === 1, 'One assessment attempt per repeated submit');
  releaseAssessment(); await until(() => document.body.textContent.includes('+20 credits earned'), 'Assessment result');
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
    document.getElementById('manage-tab-resources').click(); await until(() => document.getElementById('probe').dataset.url.endsWith('#manage-panel-resources') && visible('#manage-panel-resources').length, 'Resources navigation commit');
    document.getElementById('manage-tab-topics').click(); await until(() => document.getElementById('probe').dataset.url.endsWith('#manage-panel-topics') && visible('#manage-panel-topics').length, 'Topics navigation commit');
    document.getElementById('back').click(); await until(() => document.getElementById('probe').dataset.url.endsWith('#manage-panel-resources') && visible('#manage-panel-resources').length, 'Learning back');
    document.getElementById('forward').click(); await until(() => document.getElementById('probe').dataset.url.endsWith('#manage-panel-topics') && visible('#manage-panel-topics').length, 'Learning forward');
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
  for (const role of ['moderator', 'admin']) {
    await render(role === 'moderator' ? '/moderator/reviews' : '/admin/moderation', { ...student, role });
    await until(() => document.querySelector('.staff-review-header > button'), 'Review action');
    const beforeReview = reviewWrites; document.querySelector('.staff-review-header > button').click();
    await until(() => document.querySelector('[role="dialog"]'), 'Review visibility confirmation'); await cancelDialog();
    assert(reviewWrites === beforeReview, 'Review Cancel writes nothing');
    document.querySelector('.staff-review-header > button').click(); await until(() => document.querySelector('[role="dialog"]'), 'Review confirm again');
    await acceptDialog(review.isHidden ? 'Restore review' : 'Hide review');
    await until(() => reviewWrites === beforeReview + 1, 'One review mutation');
  }
  checks.push('Moderator/Admin shared Hide/Restore review confirmation and Cancel without mutation');
  await render('/moderator/learning#manage-panel-resources', { ...student, role: 'moderator' });
  await until(() => document.querySelector('.learning-submission-meta'), 'Submission review metadata');
  const reviewPanel = document.querySelector('#manage-panel-resources');
  assert(reviewPanel.textContent.includes('Awaiting review (1)') && reviewPanel.textContent.includes('Nathan Santos') && reviewPanel.textContent.includes('Java') && reviewPanel.querySelector('time'), 'Submission context/title/topic/creator/date');
  assert(reviewPanel.querySelectorAll('.learning-management-item').length === 1, 'Pending submissions are the default review list');
  [...reviewPanel.querySelectorAll('.learning-review-filters button')].find((button) => button.textContent === 'Published').click();
  await until(() => reviewPanel.querySelector('.learning-management-item h3')?.textContent === 'Java basics', 'Published review filter');
  assert(reviewPanel.querySelector('.learning-management-item .btn-danger').textContent === 'Archive', 'Published resource danger action');
  checks.push('Pending-review filter and title/topic/submitter/type/date/preview metadata; reviewed-resource filters');
  for (const [path, endpoint, expected] of [
    ['/admin/audit-logs', '/api/admin/audit-logs', 'Audit records are unavailable'],
    ['/admin/security', '/api/admin/security', 'Security activity is unavailable'],
    ['/admin/credits', '/api/admin/credits/rules', 'Credit administration is unavailable'],
    ['/moderator/learning', '/api/moderator/learning/topics', 'Learning management is unavailable'],
    ['/moderator/assessments', '/api/moderator/assessments', 'Assessment drafts are unavailable'],
    ['/learning', '/api/learning/topics', 'Learning topics could not be loaded'],
    ['/assessments', '/api/assessments', 'Assessments unavailable'],
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
  for (const path of ['/', '/about', '/features', '/login', '/register', '/verify-email/pending', '/verify-email', '/forgot-password', '/reset-password']) {
    await render(path, null); assert(document.documentElement.scrollWidth <= innerWidth, 'Public/auth overflow: ' + path);
  }
  await render('/onboarding', { ...student, onboardingFinishedAt: null, skillsToLearn: [], skillsToTeach: [] }); assert(document.documentElement.scrollWidth <= innerWidth, 'Onboarding overflow');
  checks.push('Representative Student/staff/auth/public/onboarding routes at CSS viewport with scale 1 and fresh default zoom');
  await render('/', null); await until(() => document.querySelector('.landing-network'), 'Original Landing illustration');
  assert(document.querySelector('.landing-network').getAttribute('aria-label')?.length > 20, 'Illustration alternative description');
  assert(!document.querySelector('.landing-study-photo'), 'Rejected photo design removed');
  if (window.__acadovaFontsLoaded) checks.push('Canonical Inter, Plus Jakarta Sans and JetBrains Mono loaded before UI checks');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    assert(getComputedStyle(document.querySelector('.landing-skill-node')).animationName === 'none', 'Hero remains static with reduced motion');
    assert(Number.parseFloat(getComputedStyle(document.querySelector('.btn')).transitionDuration) < .001, 'Reduced-motion interactions');
  }
  await render('/register', null);
  [...document.querySelectorAll('button')].find((button) => button.textContent.includes('Review Terms')).click();
  await until(() => document.querySelector('.policy-review-dialog'), 'Policy review dialog');
  const policyCheck = document.querySelector('.policy-review-actions input');
  assert(policyCheck.getBoundingClientRect().width >= 24 && policyCheck.getBoundingClientRect().height >= 24, 'Policy agreement hit area');
  assert([...document.querySelectorAll('.policy-review-dialog button')].every((button) => button.getBoundingClientRect().height >= 44), 'Policy dialog controls too small');
  document.querySelector('[aria-label="Close policy review"]').click(); await until(() => !document.querySelector('.policy-review-dialog'), 'Policy close');
  await render('/sessions'); await until(() => document.querySelector('.session-card-destination'), 'Single-destination Session');
  const singleCard = document.querySelector('.student-session-card'); singleCard.scrollIntoView({ block: 'center', behavior: 'instant' }); await pause();
  const singleBounds = singleCard.getBoundingClientRect();
  assert(document.elementFromPoint(singleBounds.left + 6, singleBounds.top + 6)?.closest('a') === singleCard.querySelector('.session-card-destination'), 'Single-destination Session whole surface');
  const savedSession = roomSession; roomSession = { ...roomSession, status: 'pending', tutor: student, learner: peer, canonicalStatus: undefined };
  await render('/sessions'); await until(() => document.querySelector('.student-session-actions button'), 'Teaching request actions');
  const requestCard = document.querySelector('.student-session-card'); requestCard.scrollIntoView({ block: 'center', behavior: 'instant' }); await pause();
  const cardBounds = requestCard.getBoundingClientRect();
  assert(!requestCard.querySelector('.session-card-destination') && !document.elementFromPoint(cardBounds.left + 6, cardBounds.top + 6)?.closest('a'), 'Multi-action Session background must stay passive');
  const explicitView = requestCard.querySelector('.student-session-actions a');
  assert(explicitView?.getAttribute('href') === '/sessions/s' && explicitView.getBoundingClientRect().height >= 44, 'Multi-action View Session target');
  for (const action of requestCard.querySelectorAll('button')) { const box = action.getBoundingClientRect(); assert(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest('button') === action, 'Session action is not covered by destination'); }
  roomSession = savedSession;
  roomSession = { ...roomSession, status: 'scheduled', scheduledAt: '2099-10-01T10:00:00.000Z' };
  await render('/dashboard', { ...student, skillsToTeach: [] });
  await until(() => document.querySelector('#next-session-heading') && document.querySelector('#peers-heading') && document.querySelector('.profile-reminders'), 'Dashboard populated sections');
  const dashboardBlocks = visible('.student-dashboard > .home-welcome, .student-dashboard > .home-context-grid, .student-dashboard > section').filter((element) => element.children.length);
  for (let index = 1; index < dashboardBlocks.length; index++) {
    assert(dashboardBlocks[index].getBoundingClientRect().top - dashboardBlocks[index - 1].getBoundingClientRect().bottom >= 31.9, 'Dashboard sections accidentally touch');
  }
  assert(document.querySelectorAll('.home-welcome .home-path-arrow').length === 3, 'Dashboard shortcut destination affordance');
  roomSession = savedSession;
  checks.push('Populated Upcoming/Continue/Peers/Topics/setup Dashboard sections have consistent physical separation');
  checks.push('All rendered controls at least 24px; primary buttons/tabs/account/notifications at least 44px; About/Features/verification and restored named illustration');
  const capture = capturePath;
  const publicCapture = ['/', '/about', '/features', '/login', '/register', '/verify-email', '/verify-email/pending', '/forgot-password', '/reset-password'].includes(capture);
  await render(capture || '/admin/users', publicCapture ? null : { ...student, role: capture?.startsWith('/moderator') ? 'moderator' : capture?.startsWith('/admin') ? 'admin' : 'student' });
  window.scrollTo({ top: 0, behavior: 'instant' }); await pause(300);
  assert(errors.length === 0, 'Runtime errors: ' + errors.join('; '));
  document.getElementById('result').textContent = `PASS: ${innerWidth}x${innerHeight} hardening\n${checks.join('\n')}`;
  document.getElementById('result').hidden = true;
} catch (error) { document.getElementById('result').textContent = `FAIL: ${error.message}\n${checks.join('\n')}`; }
