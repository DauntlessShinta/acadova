// Actual App routing and CSS, with isolated API fixtures; never a live DB.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../src/App';
import AuthContext from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import { useToast } from '../src/context/toastAccess';
import '../src/index.css';

const student = { _id: 'student', name: 'JosÃ© Dela Cruz', role: 'student', credits: 100, onboardingFinishedAt: '2026-10-01', skillsToLearn: ['Python'], skillsToTeach: ['Mathematics'] };
const peer = { ...student, _id: 'peer', name: 'Mary-Jane Oâ€™Connor', skillsToTeach: ['Python'], rating: 5 };
const session = { _id: 'demo', learner: student, tutor: peer, subject: 'Python fundamentals', status: 'scheduled', scheduledAt: new Date().toISOString(), meetingMethod: 'online', meetingLink: 'https://example.com/meeting', creditAmount: 50, requestMessage: 'Help with functions and loops.' };
const topics = [
  { id: 'python', title: 'Python fundamentals', description: 'Functions and loops' },
  { id: 'math', name: 'Mathematics', description: 'Algebra basics' },
  { id: 'programming', title: 'Programming Fundamentals', description: 'Learn the basic concepts of programming, including variables, conditions, and problem solving.' },
  { id: 'writing', title: 'Academic Writing', description: 'Plan clear arguments and support them with reliable sources.' },
  { id: 'networking', title: 'Computer Networks', description: 'Learn how computers communicate.' },
];
const learningResources = [
  { id: 'osi', title: 'Understanding the OSI Model', description: 'Explore the seven layers of network communication.', resourceType: 'url', externalUrl: 'https://www.cloudflare.com/learning/ddos/glossary/open-systems-interconnection-model-osi/', creditCost: 0, locked: false },
  { id: 'tcp', title: 'TCP/IP Basics', description: 'Understand how protocols carry data between computers.', resourceType: 'url', externalUrl: 'https://www.cloudflare.com/learning/ddos/glossary/tcp-ip/', creditCost: 0, locked: false },
  { id: 'notes', title: 'Network study notes', description: 'Read a short summary.', resourceType: 'text', textContent: 'Layers organize network responsibilities.\nProtocols let devices exchange data.', creditCost: 0, locked: false },
  { id: 'private', title: 'Additional reading', description: 'A locked resource.', resourceType: 'text', creditCost: 20, locked: true },
];
const learningModules = [
  { id: 'net-module', title: 'Networking Fundamentals', description: 'Study the OSI model and TCP/IP in order.', creditCost: 0, locked: false, resources: learningResources.slice(0, 2), assessment: 'network-assessment' },
  { id: 'notes-module', title: 'Network Reading', description: 'Review a short reading resource.', creditCost: 0, locked: false, resources: [learningResources[2]], assessment: null },
  { id: 'locked-module', title: 'Further study', description: 'A locked unit.', creditCost: 25, locked: true },
  { id: 'empty-module', title: 'Upcoming materials', description: 'No resources yet.', creditCost: 0, locked: false, resources: [], assessment: null },
];
const topicDetail = (topic) => ({ ...topic, resources: topic.id === 'networking' ? learningResources.map(({ externalUrl: _externalUrl, textContent: _textContent, ...preview }) => preview) : [],
  modules: topic.id === 'networking' ? learningModules.map((module) => ({ ...module, ...(module.resources ? { resources: module.resources.map((resource) => resource.id) } : {}) })) : [], assessments: [] });
let writes = 0;
let failActions = false;
window.fetch = async (url, options = {}) => {
  if (options.method && options.method !== 'GET') writes++;
  if (failActions && options.method && options.method !== 'GET') return new Response(JSON.stringify({ message: 'Connection unavailable. Try again.' }), { status: 503 });
  const route = String(url).split('?')[0];
  const data = route === '/api/learning/topics' ? topics : route.startsWith('/api/learning/topics/') ? topicDetail(topics.find((topic) => topic.id === route.split('/').at(-1))) : route.startsWith('/api/learning/modules/') ? learningModules.find((module) => module.id === route.split('/').at(-1)) : route.startsWith('/api/learning/resources/') ? learningResources.find((resource) => resource.id === route.split('/').at(-1)) : route.includes('/moderator/learning/resources') ? learningResources : route.includes('unread-count') ? { count: 0 }
    : route === '/api/sessions/demo' ? session
      : route === '/api/sessions' ? [session]
        : route === '/api/users/tutors' ? [peer]
          : route === '/api/users/peer' ? peer
            : route === '/api/users/me' ? student
              : route === '/api/admin/users' ? [student, peer]
                : route === '/api/credits/rules' ? { tutoringSessionCost: 50 }
                  : route.includes('/analytics/sessions') ? { total: 1 }
                    : [];
  return new Response(JSON.stringify({ success: true, data, message: 'Saved' }), { status: 200 });
};
const assert = (value, label) => { if (!value) throw new Error(label); };
const pause = () => new Promise((resolve) => setTimeout(resolve, 40));
const until = async (check, label) => { for (let i = 0; i < 100; i++) { if (check()) return; await pause(); } throw new Error(label); };
const visible = (selector) => [...document.querySelectorAll(selector)].filter((element) => element.getClientRects().length);
const root = createRoot(document.getElementById('root'));
const capturePath = new URLSearchParams(window.location.search).get('capture') || '/dashboard';
let key = 0;
// oxlint-disable-next-line react/only-export-components
function ToastProbe() { const toast = useToast(); const location = useLocation(); return <button data-path={location.pathname} id="toast-probe" hidden onClick={() => toast('success', 'Profile saved.')}>Toast probe</button>; }
const render = async (path, user = student) => { const previousProbe = document.querySelector('#toast-probe'); root.render(<AuthContext.Provider value={{ user, credits: 100, loading: false, isAuthenticated: Boolean(user), refreshUser: async () => {}, login: async () => { throw new Error('Connection unavailable.'); }, register: async () => { throw new Error('Connection unavailable.'); }, logout: () => {} }}><ToastProvider><ConfirmProvider><MemoryRouter key={++key} initialEntries={[path]}><App /><ToastProbe /></MemoryRouter></ConfirmProvider></ToastProvider></AuthContext.Provider>); await until(() => document.querySelector('#toast-probe') !== previousProbe && document.querySelector('#toast-probe')?.dataset.path === path.split('?')[0], 'Router commit: ' + path); };
const tab = async (id) => { document.getElementById(id).click(); await pause(); };
const fill = (selector, value) => {
  const input = document.querySelector(selector);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const fillSearch = (input, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); };
const checks = [];
const runtimeErrors = [];
window.addEventListener('error', (event) => runtimeErrors.push(event.message));
window.addEventListener('unhandledrejection', (event) => runtimeErrors.push(String(event.reason)));
try {
  for (const path of ['/dashboard', '/tutors', '/tutors/peer', '/sessions', '/sessions/demo', '/credits', '/learning', '/profile', '/onboarding', '/about']) {
    await render(path, path === '/onboarding' ? { ...student, onboardingFinishedAt: null, skillsToLearn: [], skillsToTeach: [] } : student); await until(() => document.querySelector('#main-content h1'), `Route failed: ${path}`); await pause();
    if (innerWidth > 1024) { assert(visible('.student-utility-bar').length === 1, 'Desktop utilities missing'); assert(!document.querySelector('.student-sidebar .notification-trigger'), 'Notifications duplicated in sidebar'); assert(visible('.student-utility-bar .account-trigger').length === 1, 'Top account missing'); }
    const header = visible('.student-utility-bar, .student-mobile-header')[0];
    assert(header && document.querySelector('#main-content h1').getBoundingClientRect().top >= header.getBoundingClientRect().bottom, `Heading under header: ${path}`);
    assert(visible('.student-mobile-bottom').length === (innerWidth <= 1024 ? 1 : 0), `Bottom navigation breakpoint: ${path}`);
    if (innerWidth > 1024) assert(visible('.student-utility-bar input[type="search"]').length === 1, `Desktop search field: ${path}`);
    assert(!document.querySelector('.site-navbar'), `Old navigation: ${path}`);
    assert(visible('.student-sidebar').length === (innerWidth > 1024 ? 1 : 0), `Sidebar breakpoint: ${path}`);
    assert(document.documentElement.scrollWidth <= innerWidth, `Overflow: ${path}; ${[...document.querySelectorAll('body *')].filter((node) => node.getBoundingClientRect().right > innerWidth + 1).slice(0, 6).map((node) => `${node.tagName}.${node.className}: ${node.getBoundingClientRect().right}`).join('; ')}`);
    if (innerWidth > 1024) assert(document.querySelector('.student-sidebar').scrollHeight <= innerHeight, `Sidebar scroll: ${path}`);
    if (path === '/dashboard' && innerWidth > 1024) assert(document.querySelector('#next-session-heading').getBoundingClientRect().bottom < innerHeight, 'Next Session below desktop fold');
    if (path === '/learning') {
      await until(() => document.querySelectorAll('.learning-topic-results article').length === 5, 'Five published topics');
      const cards = [...document.querySelectorAll('.learning-topic-results article')];
      cards.forEach((card, index) => {
        assert(card.querySelector('h2').textContent === (topics[index].title || topics[index].name), 'Published title missing');
        assert(card.querySelector('p').textContent === topics[index].description, 'Description truncated');
      });
      const columns = getComputedStyle(document.querySelector('.learning-topic-results')).gridTemplateColumns.split(' ').length;
      assert(columns === (innerWidth >= 1440 ? 3 : innerWidth > 700 ? 2 : 1), 'Topic grid density');
      if (innerWidth >= 1440 && innerHeight >= 768) assert(cards.at(-1).getBoundingClientRect().bottom < innerHeight, 'Five topics below desktop fold');
      cards[2].querySelector('button').click();
      await until(() => document.querySelector('.learning-page-header h1')?.textContent === 'Programming Fundamentals', 'Topic detail title');
      await tab('learning-tab-contribute');
      assert(document.querySelector('option[value="programming"]').textContent === 'Programming Fundamentals', 'Contribution topic label');
    }
    if (path === '/sessions/demo') {
      await until(() => visible('a[href="https://example.com/meeting"]').length === 1, 'Join action missing or duplicated');
      assert(visible('a[href="https://example.com/meeting"]').length === 1, 'Join action missing or duplicated');
      assert(visible('#room-panel-overview').length === 1 && !visible('#room-panel-messages').length, 'Default Session panel');
      await tab('room-tab-messages'); await until(() => visible('#session-message').length === 1, 'Messages unreachable');
      document.getElementById('room-tab-messages').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await pause();
      assert(document.activeElement.id === 'room-tab-progress' && visible('#room-panel-progress').length, 'Keyboard tabs');
      await tab('room-tab-progress'); assert(visible('.session-progress').length === 1, 'Mobile progress unreachable');
      checks.push('Session header/action, tab visibility, keyboard navigation, mobile progress');
    }
  }
  checks.push('Actual App Student routes, Help shell, overflow, sidebar fit, Home fold');
  const openNetworking = async () => {
    await render('/learning'); await until(() => document.querySelectorAll('.learning-topic-results article').length === 5, 'Learning library');
    [...document.querySelectorAll('.learning-topic-results article')].find((card) => card.querySelector('h2').textContent === 'Computer Networks').querySelector('button').click();
    await until(() => document.querySelector('#learning-modules-heading'), 'Topic modules');
  };
  const openLearningModule = async (title) => {
    [...document.querySelectorAll('.learning-module-summary')].find((card) => card.querySelector('h3').textContent === title).querySelector('button').click();
    await until(() => document.querySelector('.learning-page-header h1')?.textContent === title, 'Module content'); await pause();
  };
  const safeExternalAction = () => {
    const action = document.querySelector('.learning-external-action');
    assert(action && action.target === '_blank' && action.rel.includes('noopener') && action.rel.includes('noreferrer'), 'External link safety');
    assert(action.textContent.includes('Open resource') && action.textContent.includes('new tab'), 'External action name');
    action.focus();
    assert(document.activeElement === action, 'External action cannot receive focus');
    assert(getComputedStyle(action).outlineStyle !== 'none', 'External action focus missing');
    assert(action.getBoundingClientRect().height >= 44, 'External action not tappable');
  };
  await openNetworking();
  assert(document.querySelector('.learning-page-header').textContent.includes('4 modules') && document.querySelector('.learning-page-header').textContent.includes('4 resources'), 'Real topic metadata');
  assert(document.querySelector('.learning-module-summary:last-child').textContent.includes('0 learning resources'), 'Returned empty module count');
  assert(![...document.querySelectorAll('.learning-module-summary')].find((card) => card.textContent.includes('Further study')).textContent.includes('0 learning resources'), 'Invented locked module count');
  await openLearningModule('Networking Fundamentals');
  assert([...document.querySelectorAll('.learning-resource-order strong')].map((node) => node.textContent).join('|') === 'Understanding the OSI Model|TCP/IP Basics', 'Module order changed');
  assert(document.querySelector('.learning-assessment a').getAttribute('href') === '/assessments?open=network-assessment', 'Assessment relationship changed');
  assert(document.querySelector('.learning-assessment').compareDocumentPosition(document.querySelector('.learning-module-layout')) & Node.DOCUMENT_POSITION_PRECEDING, 'Assessment is not final');
  assert(document.querySelector('.learning-resource-order').textContent.includes('cloudflare.com'), 'Resource source missing');
  safeExternalAction();
  document.querySelectorAll('.learning-resource-order button')[1].click(); await pause();
  assert(document.querySelector('.learning-current-resource h2').textContent === 'TCP/IP Basics', 'Resource selection');
  document.querySelector('.learning-lesson-actions button').click(); await pause();
  assert(document.querySelector('.learning-current-resource h2').textContent === 'Understanding the OSI Model', 'Previous resource');
  assert(document.documentElement.scrollWidth <= innerWidth, 'Module overflow');
  document.querySelectorAll('.learning-breadcrumbs button')[1].click(); await pause();
  await openLearningModule('Network Reading');
  assert(!document.querySelector('.learning-assessment'), 'Invented assessment');
  assert(document.querySelector('.learning-current-resource').textContent.includes('Protocols let devices exchange data.'), 'Text resource missing');
  document.querySelectorAll('.learning-breadcrumbs button')[1].click(); await pause();
  await openLearningModule('Upcoming materials');
  assert(document.querySelector('.learning-content-detail').textContent.includes("doesn't have learning materials"), 'Empty module recovery');
  document.querySelectorAll('.learning-breadcrumbs button')[1].click(); await pause();
  await openLearningModule('Further study');
  document.querySelector('.learning-unlock button').click(); await until(() => document.querySelector('[role="dialog"]'), 'Unlock confirmation');
  assert(document.querySelector('[role="dialog"]').textContent.includes('25 credits'), 'Unlock price changed');
  [...document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent === 'Cancel').click(); await pause();
  document.querySelectorAll('.learning-breadcrumbs button')[1].click(); await pause();
  document.querySelector('.learning-resource-list button').click();
  await until(() => document.querySelector('.learning-page-header h1')?.textContent === 'Understanding the OSI Model', 'Resource detail');
  safeExternalAction();
  assert(document.querySelector('.learning-content-detail').textContent.includes('Free resource'), 'Free resource metadata');
  assert(document.documentElement.scrollWidth <= innerWidth, 'Resource detail overflow');
  document.querySelectorAll('.learning-breadcrumbs button')[1].click(); await pause();
  assert(document.querySelector('#learning-modules-heading'), 'Back to topic failed');
  assert(writes === 0, 'Learning presentation wrote data');
  checks.push('Topic/module/resource hierarchy, ordered study, external actions/focus, assessment/no-assessment, empty/locked content and cancellation');

  await render('/dashboard'); await until(() => document.querySelector('.home-path'), 'Search Home');
  if (innerWidth <= 1024) { document.querySelector('.student-mobile-utilities button[aria-label="Search Acadova"]').click(); await until(() => document.querySelector('[role="dialog"] .discovery-search'), 'Mobile search dialog'); }
  const searchForm = visible('.discovery-search')[0];
  fillSearch(searchForm.querySelector('input'), 'Python'); await pause();
  searchForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => document.querySelector('#toast-probe')?.dataset.path === '/tutors', 'Tutor search navigation');
  assert(document.querySelector('#tutor-search')?.value === 'Python', 'Tutor skill query missing');
  if (innerWidth <= 1024) { document.querySelector('.student-mobile-utilities button[aria-label="Search Acadova"]').click(); await until(() => document.querySelector('[role="dialog"] .discovery-search'), 'Second mobile search'); }
  const learningSearch = visible('.discovery-search')[0];
  learningSearch.querySelector('select').value = 'learning'; learningSearch.querySelector('select').dispatchEvent(new Event('change', { bubbles: true }));
  fillSearch(learningSearch.querySelector('input'), 'loops'); await pause();
  learningSearch.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => document.querySelector('.learning-search-summary'), 'Learning search navigation');
  assert(document.querySelector('.learning-topic-results').textContent.includes('Python'), 'Learning scope query missing');
  await render('/learning?q=loops'); await until(() => document.querySelector('.learning-search-summary'), 'Topic search');
  assert(document.querySelector('.learning-topic-results').textContent.includes('Python') && !document.querySelector('.learning-topic-results').textContent.includes('Mathematics'), 'Topic filter is not real');
  await render('/learning?q=unavailable'); await until(() => document.body.textContent.includes('No matching learning topics'), 'No-results recovery');
  [...document.querySelectorAll('button')].find((button) => button.textContent === 'Clear search').click(); await pause();
  assert(document.querySelector('.learning-topic-results').textContent.includes('Mathematics'), 'Clear search did not restore topics');
  await render('/learning?q=Java.*'); await until(() => document.body.textContent.includes('No matching learning topics'), 'Literal pattern no-results state');
  assert(document.querySelector('.learning-topic-results a').getAttribute('href') === '/tutors', 'Learning fallback forwarded an unsupported Tutor pattern');
  checks.push('Scoped global search, real topic filtering and no-results recovery');
  await render('/about', { ...student, onboardingFinishedAt: null, skillsToLearn: [], skillsToTeach: [] });
  await until(() => document.querySelector('#main-content h1'), 'Help should remain available before onboarding');
  for (const role of ['admin', 'moderator']) {
    await render('/' + role, { ...student, role }); await until(() => document.querySelector('.staff-content h1'), 'Staff route'); await pause();
    if (innerWidth > 1024 && innerHeight > 620) { const sidebar = document.querySelector('.staff-sidebar'); assert(sidebar.scrollHeight <= sidebar.clientHeight, `${role} sidebar scroll`); assert(visible('.staff-sidebar .account-trigger').length, 'Staff account inaccessible'); }
    assert(document.documentElement.scrollWidth <= innerWidth, 'Staff overflow');
    await render('/' + role + '/learning', { ...student, role }); await until(() => document.querySelector('#topic-name'), 'Staff learning');
    await tab('manage-tab-resources'); assert(document.querySelector('#manage-panel-resources a.external-resource-link')?.rel.includes('noopener'), 'Staff external review link'); assert(visible('#manage-panel-resources').length && !visible('#manage-panel-topics').length, 'Staff workflow panels');
    await render('/' + role + '/assessments', { ...student, role });
    await until(() => document.querySelector('#assessment-management-tab-builder'), 'Assessment sections');
    await tab('assessment-management-tab-builder'); assert(visible('#assessment-title').length, 'Assessment builder unreachable');
    await tab('assessment-management-tab-drafts'); assert(!visible('#assessment-title').length, 'Assessment builder remains stacked');
  }
  checks.push('Admin/Moderator sidebar fit, account, Learning sections');
  await render('/register', null); await until(() => document.querySelector('#register-name'), 'Register route');
  document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await pause();
  assert(document.activeElement.id === 'register-name' && document.querySelector('#register-name-error'), 'First invalid Register field');
  assert(!document.body.textContent.includes('Check the highlighted'), 'Redundant validation banner');
  assert(writes === 0, 'Read-only layout checks wrote data');
  checks.push('Register inline validation and first-error focus');
  await render('/login', null); await until(() => document.querySelector('#login-email'), 'Login route');
  document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await pause();
  assert(document.activeElement.id === 'login-email' && document.querySelector('#login-email-error'), 'Login inline validation');
  fill('#login-email', 'student@example.test'); fill('#login-password', 'Example!123'); await pause();
  document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => document.querySelector('.app-toast-error'), 'Login failure not global');
  failActions = true;
  await render('/forgot-password', null); await until(() => document.querySelector('#recovery-email'), 'Recovery route');
  fill('#recovery-email', 'student@example.test'); await pause();
  document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => document.querySelector('.app-toast-error')?.textContent.includes('process your request'), 'Recovery failure not global');
  window.history.replaceState({}, '', '/__demo-test?token=fixture');
  await render('/reset-password', null); await until(() => document.querySelector('#reset-password'), 'Reset route');
  fill('#reset-password', 'weak'); fill('#reset-confirm', 'weak'); await pause();
  document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await pause();
  assert(document.querySelector('#reset-password-error') && document.activeElement.id === 'reset-password', 'Reset field validation');
  fill('#reset-password', 'Example!123'); fill('#reset-confirm', 'Example!123'); await pause();
  document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => document.querySelector('.app-toast-error')?.textContent.includes('reset your password'), 'Reset failure not global');
  await render('/verify-email/pending', null); await until(() => document.querySelector('#pending-email'), 'Pending verification route');
  fill('#pending-email', 'student@example.test'); await pause();
  document.querySelector('.auth-submit').click();
  await until(() => document.querySelector('.app-toast-error')?.textContent.includes('request a new email'), 'Resend failure not global');
  checks.push('Login/Reset inline errors; Login/recovery/reset/resend failures use root Toast');
  await render('/profile'); await until(() => document.querySelector('#name'), 'Profile route'); await pause();
  failActions = true; document.querySelector('.profile-layout form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => document.querySelector('.app-toast-error'), 'Network action failure was not global');
  assert(document.querySelector('.toast-viewport').parentElement === document.body && document.querySelectorAll('.toast-viewport').length === 1, 'Toast must have one body portal');
  document.getElementById('toast-probe').click(); document.getElementById('toast-probe').click(); await pause();
  assert(document.querySelectorAll('.app-toast').length === 1, 'Toast burst stacked over workflow controls');
  window.scrollTo(0, document.body.scrollHeight); await pause();
  if (innerWidth > 1024) assert(document.querySelector('.student-utility-bar').getBoundingClientRect().top === 0, 'Global utilities are not sticky');
  const bounds = document.querySelector('.toast-viewport').getBoundingClientRect();
  assert(bounds.top >= 0 && bounds.bottom < innerHeight && bounds.left >= 0 && bounds.right <= innerWidth, 'Toast outside viewport after scrolling');
  checks.push('Action network failure, one global portal, fixed toast after scroll');
  failActions = false;
  document.querySelectorAll('.app-toast button').forEach((button) => button.click()); await pause();
  const capture = capturePath;
  await render(capture, { ...student, role: capture.startsWith('/admin') ? 'admin' : capture.startsWith('/moderator') ? 'moderator' : 'student' });
  await until(() => document.querySelector('#main-content h1'), 'Capture route'); await pause(); window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); await pause();
  if (capture === '/learning') await until(() => document.querySelectorAll('.learning-topic-results article').length === 5, 'Learning capture data');
  const captureHeader = visible('.student-utility-bar, .student-mobile-header')[0];
  if (captureHeader) assert(document.querySelector('#main-content h1').getBoundingClientRect().top >= captureHeader.getBoundingClientRect().bottom, 'Capture heading under header');
  if (capture === '/sessions/demo') await until(() => document.querySelector('#room-tab-overview'), 'Session capture');
  const preview = new URL('https://fixture.test' + capture).searchParams.get('preview');
  if (preview) {
    await openNetworking();
    if (preview === 'module') await openLearningModule('Networking Fundamentals');
    if (preview === 'resource') { document.querySelector('.learning-resource-list button').click(); await until(() => document.querySelector('.learning-external-action'), 'Resource capture'); }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); await pause();
  }
  assert(runtimeErrors.length === 0, 'Browser runtime errors: ' + runtimeErrors.join('; '));
  document.getElementById('result').textContent = `PASS: ${innerWidth}x${innerHeight} correction checks\n${checks.join('\n')}`;
  document.getElementById('result').style.display = 'none';
} catch (error) { document.getElementById('result').textContent = `FAIL: ${error.message}\n${checks.join('\n')}`; }
