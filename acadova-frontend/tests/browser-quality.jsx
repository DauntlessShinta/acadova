// Actual routed React app/providers/CSS; every fetch is an in-memory fixture.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import '../src/index.css';

const student = { _id: 'me', name: 'Alex Santos', email: 'alex@example.test', role: 'student', credits: 100,
  emailVerified: true, rating: null, ratingCount: 0, onboardingFinishedAt: '2026-10-01', skillsToLearn: ['Java'], skillsToTeach: ['Math'] };
let peer = { ...student, _id: 'peer', name: 'Nathan Alejandro Santos', skillsToTeach: ['Java'], suspendedAt: null };
const topic = { id: 'topic', name: 'Java', description: 'Learn Java basics.', status: 'published' };
const resource = { id: 'r', topic: topic.id, title: 'Java basics', description: 'Read a short explanation.', resourceType: 'text', textContent: 'A useful Java lesson.', reviewStatus: 'published', creditCost: 0,
  submittedBy: peer._id, submitterName: peer.name, createdAt: '2026-10-01T10:00:00.000Z' };
const module = { id: 'module', topic: topic.id, title: 'Java module', description: 'Study Java in order.', status: 'published', resources: [resource], unavailableResourceCount: 1, creditCost: 0, locked: false };
const questions = Array.from({ length: 3 }, (_, i) => ({ prompt: `Choose the right answer for question ${i + 1}`, options: ['First', 'Second'] }));
const assessment = { id: 'a', title: 'Java check', topic: 'Java', questionCount: 3, passingScore: 60, questions };
const session = { _id: 's', subject: 'Java tutoring', learner: student, tutor: peer, status: 'disputed', meetingMethod: 'online',
  creditAmount: 20, scheduledAt: new Date().toISOString(), reviewIndicators: ['prior_credit_transaction'], disputeReason: 'Please review the recorded evidence.' };
const rules = { startingCreditGrant: 100, tutoringSessionCost: 20, assessmentReward: 20, version: 1 };
let current = student;
let waitForTutors = false; let releaseTutors;
let roomSession = { ...session, status: 'scheduled', meetingLink: 'https://example.com/meeting' };
let review = { _id: 'rating', rating: 4, comment: 'Helpful session.', isHidden: false, fromUser: peer, toUser: student,
  session: { subject: 'Java tutoring' }, createdAt: new Date().toISOString() };
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify({ success: status < 400, data, ...extra }), { status });
window.fetch = async (url, options = {}) => {
  const route = new URL(String(url), 'https://fixture.test').pathname;
  if (options.method && options.method !== 'GET') throw new Error('Unexpected fixture write: ' + route);
  if (route === '/api/sessions/s') return json(roomSession);
  if (route === '/api/sessions/s/messages') return json(Array.from({ length: 40 }, (_, i) => ({ _id: 'msg-' + i, sender: i % 2 ? student : peer, body: i === 37 ? 'Here are the notes: https://example.test/' + 'long-path'.repeat(50) : i % 2 ? 'That helps. Could we work through an example together?' : 'We can start with arrays, then practice a small Java exercise.\nBring the question you found difficult.', createdAt: new Date(Date.now() - (40-i)*60000).toISOString() })));
  let data = [];
  if (route === '/api/sessions' || route === '/api/admin/sessions') data = [roomSession];
  if (route === '/api/users/me') data = current;
  if (route === '/api/users/tutors') data = [peer, { ...peer, _id: 'peer2', name: 'Mary-Jane O\u2019Connor', rating: 4.7, ratingCount: 3, skillsToTeach: ['Database Systems', 'Web Development'] }, { ...peer, _id: 'peer3', name: 'Nguy\u1ec5n Th\u1ecb \u00c1nh', skillsToTeach: ['Java', 'Algorithms'] }];
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
  if (route === '/api/admin/audit-logs') data = [{ _id: 'audit', actor: { _id: 'staff', name: 'Mira Reyes' }, actorRole: 'moderator', action: 'learning.resource_approved', targetType: 'LearningResource', targetId: '507f1f77bcf86cd799439011', summary: 'Published a reviewed learning resource.', createdAt: '2026-10-01T10:00:00.000Z' }];
  if (route === '/api/admin/credits/rules' || route === '/api/credits/rules') data = rules;
  if (route === '/api/admin/security') data = { counts: { cooldownStarted: 0, cooldownExtended: 0, activeCooldowns: 0, recoveredLogins: 0, suspendedAttempts: 0 }, events: [{ id: 'security-event', action: 'security.login_success_after_failures', accountId: '507f1f77bcf86cd799439011', createdAt: '2026-10-01T10:00:00.000Z' }] };
  if (route === '/api/notifications/unread-count') data = { count: 0 };
  if (route === '/api/analytics/sessions') data = { total: 0, byStatus: {} };
  if (route === '/api/analytics/ratings') data = { totalRatings: 0, averageRating: null, distribution: [] };
  if (route === '/api/analytics/credits') data = { totalTransactions: 0, breakdown: {} };
  const result = json(data, 200, { pagination: { page: 1, limit: 25, total: 0 }, summary: { recordedEarned: 0, recordedSpent: 0 } });
  if (route === '/api/users/tutors' && waitForTutors) return new Promise((resolve) => { releaseTutors = () => resolve(result); });
  return result;
};
const root = createRoot(document.getElementById('root')); let renderKey = 0;
const pause = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (value, label) => { if (!value) throw new Error(label); };
const until = async (check, label) => { for (let i = 0; i < 150; i++) { if (check()) return; await pause(); } throw new Error(label); };
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
  await until(() => document.querySelector('#root h1, .auth-form-panel h1, .auth-form h1, #login-email'), 'Loaded route: ' + path);
  await pause(100);
  for (const control of visible('button, a[href], input:not([type="hidden"]), select, summary')) {
    const box = control.getBoundingClientRect();
    assert(box.width >= 23.9 && box.height >= 23.9, `Target below 24px on ${path}: ${control.id || control.className || control.textContent?.slice(0, 45)} (${box.width}x${box.height})`);
  }
  for (const control of visible('.btn, .workflow-tabs button, .account-trigger, .notification-trigger')) {
    assert(control.getBoundingClientRect().height >= 43.9, 'Important control below 44px: ' + path + ' ' + control.className);
  }
}
const errors = []; const checks = [];
window.addEventListener('error', (event) => errors.push(event.message)); window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason)));
// The runner captures each screen at this viewport, without importing evidence into the app.
const capture = async (name) => {
  document.querySelectorAll('.app-toast button').forEach((button) => button.click());
  window.scrollTo({ top: name.startsWith('chat-') ? window.scrollY + document.querySelector('#room-panel-messages').getBoundingClientRect().top - 88 : 0, behavior: 'instant' }); await pause(240);
  if (window.__acadovaCaptureEnabled) {
    window.__acadovaCapture = name;
    await until(() => !window.__acadovaCapture, 'Screenshot handshake: ' + name);
  }
};
const keyPress = async (key) => { window.__acadovaKey = key; await until(() => !window.__acadovaKey, 'Keyboard: ' + key); await pause(60); };
const hover = async (element) => {
  element.scrollIntoView({ block: 'center', behavior: 'instant' }); await pause(60);
  const box = element.getBoundingClientRect(); window.__acadovaPointer = { x: box.x + box.width / 2, y: box.y + box.height / 2, hover: true };
  await until(() => !window.__acadovaPointer, 'Native pointer hover'); await pause(220);
};
const layout = (path) => {
  assert(document.documentElement.scrollWidth <= innerWidth, 'Page overflow: ' + path);
  for (const button of visible('.btn')) {
    const text = button.textContent.trim(); const box = button.getBoundingClientRect();
    assert(button.scrollWidth <= button.clientWidth + 1, 'Clipped action: ' + path + ' ' + text);
    const clipped = button.closest('.session-messages-panel');
    if (clipped) { const parent = clipped.getBoundingClientRect(); assert(box.left >= parent.left && box.right <= parent.right, 'Conversation action clipped'); }
    assert(getComputedStyle(button).wordBreak === 'normal', 'Action splits words: ' + text);
    assert(box.left >= -1 && box.right <= innerWidth + 1 || button.closest('.table-responsive'), 'Action outside page: ' + text);
  }
  for (const link of visible('a[href]')) assert(!link.querySelector('button, a, input, select'), 'Nested interaction: ' + path);
  for (const link of visible('.learning-section-nav a')) {
    const range = document.createRange(); range.selectNodeContents(link);
    if (!link.textContent.trim().includes(' ')) assert(range.getClientRects().length === 1, 'Learning navigation must not split a word: ' + link.textContent);
    assert(getComputedStyle(link).overflowWrap === 'normal', 'Learning navigation wraps only between words');
  }
};
try {
  assert(window.visualViewport.scale === 1 && devicePixelRatio === 1, '100% zoom baseline');
  roomSession = { ...roomSession, scheduledAt: '2099-10-01T10:00:00.000Z' };
  const screens = [
    ['landing', '/', null], ['register', '/register', null], ['login', '/login', null],
    ['about', '/about', null], ['features', '/features', null], ['terms', '/terms', null], ['privacy', '/privacy', null], ['guidelines', '/community-guidelines', null],
    ['pending', '/verify-email/pending', null], ['forgot', '/forgot-password', null], ['reset', '/reset-password', null],
    ['verification', '/verify-email', null],
    ['home', '/dashboard', student], ['tutors', '/tutors', student], ['learning', '/learning', student],
    ['tutor-profile', '/tutors/peer', student], ['assessments', '/assessments', student],
    ['onboarding', '/onboarding', { ...student, onboardingFinishedAt: null, skillsToLearn: [], skillsToTeach: [] }],
    ['sessions', '/sessions', student], ['credits', '/credits', student], ['profile', '/profile', student],
    ['messages', '/sessions?view=messages', student], ['moderator', '/moderator', { ...student, role: 'moderator' }],
    ['review', '/moderator/learning#manage-panel-resources', { ...student, role: 'moderator' }],
    ['moderator-disputes', '/moderator/disputes', { ...student, role: 'moderator' }],
    ['moderator-reviews', '/moderator/reviews', { ...student, role: 'moderator' }],
    ['moderator-assessments', '/moderator/assessments', { ...student, role: 'moderator' }],
    ['admin-overview', '/admin', { ...student, role: 'admin' }],
    ['admin-sessions', '/admin/sessions', { ...student, role: 'admin' }],
    ['admin-analytics', '/admin/analytics', { ...student, role: 'admin' }],
    ['admin-credits', '/admin/credits', { ...student, role: 'admin' }],
    ['admin-users', '/admin/users', { ...student, role: 'admin' }],
    ['admin-audit', '/admin/audit-logs', { ...student, role: 'admin' }], ['admin-security', '/admin/security', { ...student, role: 'admin' }],
  ];
  for (const [name, path, account] of screens) {
    await render(path, account); await pause(150);
    if (name === 'landing') {
      await until(() => document.querySelector('.landing-network'), 'Restored hero illustration');
      assert(document.querySelector('#sdg-title').textContent.includes('accessible learning'), 'SDG preserved');
      assert(document.querySelector('#how-it-works') && document.querySelector('#credit-system') && document.querySelector('#skill-network') && document.querySelector('#dashboard-preview'), 'Original Landing sections');
      assert(document.querySelector('.landing-peer-photo img')?.naturalWidth === 1200, 'Local peer-learning photograph decoded');
      assert(!document.querySelector('.landing-peer-visual .landing-skill-node, .landing-motion-toggle'), 'Clutter removed from hero DOM');
      assert(document.querySelectorAll('.public-brand-logo image[href="/images/acadova-logo-new.png"]').length === 2, 'Supplied public logo in Navbar and Footer');
      const heroStyle = getComputedStyle(document.querySelector('.landing-badge-row'));
      assert(heroStyle.animationIterationCount === '1' && heroStyle.animationDelay === '0s', 'Hero enters once without delayed actions');
      assert(heroStyle.animationName === (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'none' : 'landing-hero-arrival'), 'Hero honors reduced motion');
      await hover(document.querySelector('.landing-feature-card'));
      assert(getComputedStyle(document.querySelector('.landing-feature-card')).transform === 'none', 'Passive feature cards stay still');
      await hover(document.querySelector('.landing-action-row .btn-primary'));
      const moves = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches;
      const arrow = document.querySelector('.landing-action-row .btn-primary > svg');
      assert(getComputedStyle(arrow).transform === (moves ? 'matrix(1, 0, 0, 1, 3, 0)' : 'none'), 'CTA movement only for fine pointer without reduced motion');
      if (innerWidth <= 1024) {
        const menu = document.querySelector('.site-menu-button'); menu.focus(); await keyPress('Enter');
        await until(() => document.querySelector('#site-mobile-menu'), 'Public menu opens');
        document.querySelector('#site-mobile-menu a').focus(); await keyPress('Escape');
        assert(!document.querySelector('#site-mobile-menu') && document.activeElement === menu, 'Public menu Escape restores focus');
      }
    }
    if (['register','login','pending','forgot','reset'].includes(name)) {
      assert(document.querySelector('.auth-brand-panel') && document.querySelector('.auth-form-inner h2'), 'Restored split Auth hierarchy');
      assert(document.querySelector('.auth-form-inner').getBoundingClientRect().width <= 465.1, 'Original readable auth width');
    }
    if (name === 'register') {
      fill('#register-name', 'Sukarno'); fill('#register-email', 'valid@example.test'); await pause();
      document.querySelector('.auth-submit').click(); await until(() => document.querySelector('#register-password-error'), 'Inline registration validation');
      assert(document.querySelector('#register-name').value === 'Sukarno' && document.querySelector('#register-email').value === 'valid@example.test', 'Valid values preserved');
      assert(document.activeElement.id === 'register-password', 'First invalid field focused');
      await keyPress('Tab'); assert(document.activeElement.getAttribute('aria-label') === 'Show password', 'Logical auth tab order');
      await keyPress('Enter'); assert(document.querySelector('#register-password').type === 'text', 'Keyboard password toggle');
      await keyPress('Shift+Tab'); assert(document.activeElement.id === 'register-password', 'Reverse tab order');
    }
    if (['home','tutors'].includes(name)) {
      await until(() => document.querySelectorAll('.peer-card').length === 3, 'Realistic peer grid');
      for (const card of document.querySelectorAll('.peer-card')) {
        assert(!card.querySelector('a button'), 'Peer action independence');
        assert(!getComputedStyle(card.querySelector('.peer-rating')).fontFamily.includes('Mono'), 'Human reputation typography');
        for (const action of card.querySelectorAll('.peer-card-actions .btn')) {
          assert(action.scrollWidth <= action.clientWidth + 1, 'Tutor action label squeezed');
          assert(action.getBoundingClientRect().height >= 44, 'Tutor action target');
        }
      }
    }
    if (name === 'tutors') {
      assert(document.querySelector('[role="search"][aria-label="Find tutors"]'), 'Named tutor search');
      assert(document.querySelector('.subject-filter-chip[aria-pressed="true"]')?.textContent === 'All', 'Subject filter selection is announced');
      await hover(document.querySelector('.peer-card'));
      assert(getComputedStyle(document.querySelector('.peer-card')).transform === 'none', 'Multi-action Tutor card stays still');
    }
    if (account?.role === 'student' && innerWidth <= 1024) {
      const mark = document.querySelector('.student-mobile-header .staff-brand > svg').getBoundingClientRect();
      assert(mark.width >= 23 && mark.height >= 23, 'Mobile brand mark squeezed');
    }
    if (['admin-users','admin-audit','admin-sessions'].includes(name)) {
      const region = document.querySelector('.table-responsive');
      assert(region?.tabIndex === 0 && region.getAttribute('aria-label'), 'Named keyboard-scroll table region');
    }
    layout(path); await capture(name);
    if (['home','tutors'].includes(name) && window.__acadovaCaptureEnabled) { document.querySelector('.peer-card').scrollIntoView({ block: 'center', behavior: 'instant' }); await pause(120); window.__acadovaCapture = name + '-peer-actions'; await until(() => !window.__acadovaCapture, 'Peer action capture'); }
    checks.push(name);
  }
  await render('/sessions/s#session-messages', student);
  await until(() => document.querySelectorAll('.session-message').length === 40, 'Long conversation');
  const log = document.querySelector('.session-messages'); const field = document.querySelector('#session-message');
  const composer = document.querySelector('.message-composer');
  assert(composer.getBoundingClientRect().top >= log.getBoundingClientRect().bottom - 1, 'Composer must be below full-width history');
  assert(Math.abs(composer.getBoundingClientRect().width - log.getBoundingClientRect().width) < 2, 'One conversation width');
  fill('#session-message', 'Keep this draft\nwhile the conversation expands.'); await pause();
  log.scrollTop = 0; log.dispatchEvent(new Event('scroll')); await pause();
  layout('chat'); await capture('chat-normal');
  const expand = document.querySelector('.chat-expand'); const normalHeight = log.clientHeight; expand.focus(); await keyPress('Enter'); await pause(150);
  await until(() => composer.getBoundingClientRect().bottom <= innerHeight - (innerWidth <= 1024 ? 60 : 8), 'Expanded composer settles inside viewport');
  assert((innerHeight < 700 || log.clientHeight >= normalHeight * 1.25) && expand.getAttribute('aria-expanded') === 'true', 'Substantial expanded history where viewport allows');
  assert(field.value.startsWith('Keep this draft') && log.scrollTop < 2, 'Expanded draft/scroll preserved');
  layout('chat-expanded');
  const footer = composer.getBoundingClientRect();
  assert(footer.bottom <= innerHeight - (innerWidth <= 1024 ? 60 : 8), `Expanded composer obscured or below viewport: bottom=${footer.bottom}, viewport=${innerHeight}, panel=${document.querySelector('#room-panel-messages').getBoundingClientRect().top}, height=${document.querySelector('#room-panel-messages').clientHeight}`);
  if (window.__acadovaCaptureEnabled) { window.__acadovaCapture = 'chat-expanded'; await until(() => !window.__acadovaCapture, 'Expanded capture'); }
  field.focus(); await keyPress('Escape'); await pause(100);
  assert(document.activeElement === expand && expand.getAttribute('aria-expanded') === 'false' && field.value.startsWith('Keep this draft'), 'Minimize and focus restoration');
  assert(document.querySelectorAll('.message-composer').length === 1, 'One conversation state');
  checks.push('normal/expanded Chat, long URL, draft/scroll/focus preservation and real keyboard input');
  await render('/learning', student); await until(() => document.querySelector('.learning-card-action'), 'Keyboard Topic target');
  document.querySelector('.learning-card-action').focus(); await keyPress('Enter');
  await until(() => document.getElementById('probe').dataset.url.includes('topic=topic'), 'Enter opens Topic');
  checks.push('Topic card Enter activation');
  await render('/tutors', student); await until(() => document.querySelector('.subject-filter-chip'), 'Tutor filters');
  const java = [...document.querySelectorAll('.subject-filter-chip')].find((button) => button.textContent === 'Java');
  java.focus(); await keyPress('Enter'); await until(() => location.search.includes('subject=Java'), 'Keyboard subject filter routing');
  assert(java.getAttribute('aria-pressed') === 'true', 'Keyboard selection announced');
  const searchTrigger = visible('button[aria-label="Search Acadova"]')[0]; searchTrigger.focus(); await keyPress('Enter');
  await until(() => document.querySelector('[role="dialog"]'), 'Shared search dialog');
  document.querySelector('#tutor-search').focus(); await keyPress('Tab');
  assert(document.querySelector('[role="dialog"]').contains(document.activeElement), 'Modal recovers keyboard focus from outside');
  await keyPress('Escape'); assert(document.activeElement === searchTrigger, 'Shared dialog restores trigger');
  checks.push('Subject filter keyboard routing, pressed state and modal focus recovery');
  waitForTutors = true; releaseTutors = null; await render('/tutors', student);
  await until(() => releaseTutors && document.querySelector('.loading-progress'), 'Actual delayed fetch loading state');
  const loading = document.querySelector('.loading-container');
  const track = document.querySelector('.loading-progress');
  assert(loading.getAttribute('role') === 'status' && loading.querySelector('p')?.textContent.trim(), 'Loading has announced readable text');
  const originalWidth = track.getBoundingClientRect().width;
  await pause(300); assert(track.getBoundingClientRect().width === originalWidth, 'Progress animation does not change layout');
  assert(getComputedStyle(track.firstElementChild).animationName === (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'none' : 'waiting-progress'), 'Loading motion respects reduced motion');
  layout('loading'); await capture('loading-tutors'); waitForTutors = false; releaseTutors();
  await until(() => document.querySelector('.peer-card') && !document.querySelector('.loading-progress'), 'Data replaces loading promptly');
  await capture('loaded-tutors');
  const account = visible('.account-trigger')[0]; account.focus(); await keyPress('Enter');
  await until(() => document.querySelector('.account-actions'), 'Keyboard account disclosure'); await pause(220);
  assert(account.getAttribute('aria-expanded') === 'true', 'Account state is announced');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) assert(getComputedStyle(account.lastElementChild).transform === 'none' && getComputedStyle(document.querySelector('.account-actions')).animationName === 'none', 'Reduced motion removes account movement');
  await keyPress('Escape'); assert(document.activeElement === account && !document.querySelector('.account-actions'), 'Account Escape restores focus immediately');
  checks.push('Fine-pointer-only CTA hover, static multi-action/passive cards, one-time hero, real delayed loading with stable track, reduced motion and immediate keyboard account controls');
  assert(errors.length === 0, 'Browser errors: ' + errors.join('; '));
  document.getElementById('result').textContent = `PASS: ${innerWidth}x${innerHeight} quality\n${checks.join(' | ')}`;
  document.getElementById('result').hidden = true;
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.message + '\n' + checks.join(' | '); }
