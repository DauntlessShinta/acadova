// Real routes/components/CSS; all API reads and assessment submissions stay in memory.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import App from '../src/App';
import AuthContext from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import '../src/index.css';

const student = { _id: 'student', name: 'Alex Santos', role: 'student', emailVerified: true, credits: 100,
  onboardingFinishedAt: '2026-10-01', skillsToTeach: ['Java'], skillsToLearn: ['Databases'] };
const topics = [{ id: 'db', name: 'Database Systems', description: 'Study database structure and queries.' },
  { id: 'renamed', name: 'Advanced Mathematics', description: 'A renamed published topic.' }];
const questions = Array.from({ length: 3 }, (_, i) => ({ prompt: `Which answer correctly explains database concept ${i + 1}?`, options: ['First answer', 'Second answer', 'Third answer'] }));
const assessments = [
  { id: 'a', title: 'Database Fundamentals: tables, relationships, and introductory SQL', topic: 'Database Systems', questionCount: 3 },
  { id: 'legacy', title: 'Discrete Mathematics practice', topic: 'Legacy Mathematics', questionCount: 3 },
  { id: 'renamed-a', title: 'Mathematics foundations', topic: 'Previous Mathematics Name', questionCount: 3 },
];
const resources = [
  { id: 'r1', topic: 'db', title: 'Tables and relationships', description: 'Review how a database organizes related information.', resourceType: 'text', textContent: 'A table groups related records.', creditCost: 0, locked: false },
  { id: 'r2', topic: 'db', title: 'SQL reference and practical examples', description: 'Study an external reference.', resourceType: 'url', externalUrl: 'https://example.test/sql', creditCost: 0, locked: false },
  { id: 'paid-r', topic: 'db', title: 'Advanced database exercises', description: 'A paid standalone resource.', resourceType: 'text', creditCost: 25, locked: true },
];
const module = { id: 'm', topic: 'db', title: 'Database fundamentals and guided practice', description: 'Review these resources in order.', creditCost: 0, locked: false, resources: resources.slice(0, 2), assessment: 'a' };
const paidModule = { id: 'paid-m', topic: 'db', title: 'Additional practice', description: 'Paid materials with a separate entitlement.', creditCost: 30, locked: true };
let failList = false; let failTopics = false; let failAssessment = false; let failDetail = false;
let slowDetail = false; let releaseDetail; let writes = 0; let resultKind = 'pass';
let deferSubmit = false; let releaseSubmit;
const requests = [];
const response = (data, status = 200, message) => new Response(JSON.stringify({ success: status < 400, data, message }), { status });
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), 'https://fixture.test').pathname;
  requests.push([options.method || 'GET', path]);
  if (options.method === 'POST' && path === '/api/assessments/a/submit') {
    writes++;
    const body = JSON.parse(options.body);
    if (body.answers.length !== 3) throw new Error('Unexpected answer contract');
    const result = response({ score: resultKind === 'fail' ? 33 : 100, passed: resultKind !== 'fail',
      rewardIssued: resultKind === 'pass', creditsAwarded: resultKind === 'pass' ? 17 : 0 });
    return deferSubmit ? new Promise((resolve) => { releaseSubmit = () => resolve(result); }) : result;
  }
  if (options.method && options.method !== 'GET') throw new Error('Unexpected fixture write: ' + path);
  if (path === '/api/assessments') return failList ? response(null, 503, 'Assessment list unavailable.') : response(assessments);
  if (path.startsWith('/api/assessments/')) {
    if (slowDetail) return new Promise((resolve) => { releaseDetail = () => resolve(response({ ...assessments[0], questions })); });
    const item = assessments.find((assessment) => assessment.id === path.split('/').at(-1));
    return failAssessment || !item ? response(null, 404, 'Assessment not available.') : response({ ...item, questions });
  }
  if (path === '/api/learning/topics') return failTopics ? response(null, 503, 'Learning topics unavailable.') : response(topics);
  if (path.startsWith('/api/learning/topics/')) {
    if (failDetail) return response(null, 503, 'Learning content unavailable.');
    const item = topics.find((topic) => topic.id === path.split('/').at(-1));
    return item ? response({ ...item, resources: item.id === 'db' ? resources : [],
      modules: item.id === 'db' ? [{ ...module, resources: ['r1', 'r2'] }, paidModule] : [],
      assessments: item.id === 'db' ? [assessments[0]] : [assessments[2]] }) : response(null, 404, 'Topic unavailable.');
  }
  if (path === '/api/learning/modules/m') return response(module);
  if (path === '/api/learning/modules/paid-m') return response(paidModule);
  if (path.startsWith('/api/learning/resources/')) return response(resources.find((item) => item.id === path.split('/').at(-1)));
  if (path === '/api/users/me') return response(student);
  if (path === '/api/notifications/unread-count') return response({ count: 0 });
  if (path === '/api/notifications') return response([]);
  return response([]);
};
const root = createRoot(document.getElementById('root')); let renderKey = 0;
const pause = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const until = async (check, message) => { for (let i = 0; i < 150; i++) { if (check()) return; await pause(); } throw new Error(message); };
const visible = (selector) => [...document.querySelectorAll(selector)].filter((element) => element.getClientRects().length);
const keyPress = async (key) => { window.__acadovaKey = key; await until(() => !window.__acadovaKey, 'Keyboard ' + key); await pause(); };
const clickBackground = async (element) => {
  element.scrollIntoView({ block: 'center', behavior: 'instant' }); await pause();
  const bounds = element.getBoundingClientRect();
  window.__acadovaPointer = { x: bounds.left + 12, y: bounds.bottom - 12 };
  await until(() => !window.__acadovaPointer, 'Whole-row pointer activation'); await pause();
};
// oxlint-disable-next-line react/only-export-components
function Probe() { const location = useLocation(); const navigate = useNavigate(); return <span hidden id="probe" data-url={location.pathname + location.search}><button id="back" onClick={() => navigate(-1)}>Back</button><button id="forward" onClick={() => navigate(1)}>Forward</button><button id="hub" onClick={() => navigate('/assessments')}>Hub</button></span>; }
const url = () => document.getElementById('probe')?.dataset.url;
async function render(path) {
  const previous = document.getElementById('probe');
  root.render(<AuthContext.Provider value={{ user: student, credits: 100, loading: false, isAuthenticated: true, refreshUser: async () => {}, logout: () => {} }}><ToastProvider><ConfirmProvider><MemoryRouter key={++renderKey} initialEntries={[path]}><App /><Probe /></MemoryRouter></ConfirmProvider></ToastProvider></AuthContext.Provider>);
  await until(() => document.getElementById('probe') !== previous && url() === path, 'Router commit: ' + path);
  await until(() => document.querySelector('.learning-section-nav'), 'Learning navigation'); await pause();
}
const capture = async (name) => {
  document.querySelectorAll('.app-toast button').forEach((button) => button.click());
  window.scrollTo({ top: 0, behavior: 'instant' }); await pause(150);
  assert(document.documentElement.scrollWidth <= innerWidth, 'Document overflow: ' + name);
  for (const action of visible('.learning-section-nav a, .assessment-card-actions .btn, .assessment-review-actions .btn, .learning-resource-row, .learning-module-summary button')) {
    const box = action.getBoundingClientRect();
    assert(box.height >= 43.9, 'Small action: ' + name + ' ' + action.textContent);
    assert(action.scrollWidth <= action.clientWidth + 1, 'Clipped action: ' + name + ' ' + action.textContent);
    assert(box.left >= -1 && box.right <= innerWidth + 1, 'Action outside viewport: ' + name);
    assert(!action.querySelector('a, button, input'), 'Nested interactive target');
  }
  if (window.__acadovaCaptureEnabled) { window.__acadovaCapture = name; await until(() => !window.__acadovaCapture, 'Screenshot: ' + name); }
};
const checks = []; const errors = [];
window.addEventListener('error', (event) => errors.push(event.message));
window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason)));
try {
  assert(window.visualViewport.scale === 1 && devicePixelRatio === 1, '100% zoom');
  await render('/learning'); await until(() => document.querySelector('.learning-card-action'), 'Topic list');
  assert(document.querySelectorAll('.learning-section-nav a').length === 3 && !document.querySelector('.learning-section-nav [role="tab"]'), 'Section routes must be semantic navigation');
  for (const link of document.querySelectorAll('.learning-section-nav a')) {
    const range = document.createRange(); range.selectNodeContents(link);
    if (!link.textContent.trim().includes(' ')) assert(range.getClientRects().length === 1, 'Navigation must not split a word: ' + link.textContent);
    assert(getComputedStyle(link).overflowWrap === 'normal', 'Section navigation wraps at word boundaries');
  }
  await capture('learning-library');
  const hubLink = document.querySelector('#learning-tab-assessments'); hubLink.focus(); await keyPress('Enter');
  await until(() => url() === '/assessments' && document.querySelectorAll('.assessment-card').length === 3, 'Learning to hub');
  assert(document.querySelector('#learning-tab-assessments').getAttribute('aria-current') === 'page', 'Hub section current');
  assert(document.querySelector('.student-nav a[href="/learning"]').getAttribute('aria-current') === 'page', 'Learning sidebar current');
  assert(!document.querySelector('.student-nav a[href="/assessments"]'), 'No extra main-sidebar assessment entry');
  if (innerWidth > 1024) assert(document.querySelector('.learning-shell-context').textContent === 'LearningAssessments/' || document.querySelector('.learning-shell-context').textContent.replace(/\s/g, '').includes('Learning/Assessments'), 'Accurate desktop context');
  else assert(document.querySelector('.student-mobile-bottom a[href="/learning"]').getAttribute('aria-current') === 'page', 'Compact Learning parent current');
  assert(!document.querySelector('.assessment-card').textContent.includes('Passed') && !document.querySelector('.assessment-card').textContent.includes('17 credits'), 'No invented status or reward');
  await capture('assessment-hub');
  document.querySelector('.assessment-card button').focus(); await keyPress('Enter');
  await until(() => url() === '/learning?topic=db' && document.querySelector('.learning-module-summary'), 'Hub Review topic');
  assert(document.querySelector('.learning-page-header a[href="#topic-assessments"]'), 'Topic assessment shortcut');
  await capture('learning-topic');
  const topicAssessment = document.querySelector('#topic-assessments a[aria-label^="Take assessment"]'); topicAssessment.focus(); await keyPress('Enter');
  await until(() => url()?.startsWith('/assessments?open=a') && document.querySelectorAll('.assessment-option').length === 9, 'Contextual topic assessment');
  await until(() => document.querySelector('a[href="/learning?topic=db"]'), 'Topic return verified');
  assert(document.activeElement === document.querySelector('.learning-page-header h1'), 'Assessment heading focus');
  await capture('assessment-questions');
  document.querySelector('.assessment-workspace a[href="/assessments"]').click(); await until(() => url() === '/assessments' && document.querySelector('.assessment-hub-list'), 'Back clears open query');
  document.getElementById('back').click(); await until(() => document.querySelector('.assessment-workspace form'), 'Browser Back reopens assessment');
  document.getElementById('forward').click(); await until(() => document.querySelector('.assessment-hub-list'), 'Browser Forward restores hub');
  checks.push('Learning hub, contextual topic entrance, verified Review Topic, current shell/sidebar and Back/Forward');

  await render('/learning?topic=db'); await until(() => document.querySelector('.learning-module-summary button:not(:disabled)'), 'Module ready');
  await clickBackground(document.querySelector('.learning-module-summary'));
  await until(() => url() === '/learning?topic=db&module=m&lesson=0' && document.querySelector('.learning-module-layout'), 'Whole module row opens');
  await until(() => document.querySelector('.learning-assessment .assessment-card'), 'Published module assessment metadata');
  assert(document.querySelector('.learning-assessment').textContent.includes(assessments[0].title), 'Named module assessment');
  const rows = document.querySelectorAll('.learning-resource-order .learning-resource-row');
  await clickBackground(rows[1]); await until(() => url()?.endsWith('lesson=1') && document.querySelector('.learning-current-resource h2').textContent === resources[1].title, 'Whole resource row opens');
  assert(rows[1].textContent.includes('Current resource') && rows[1].getAttribute('aria-current') === 'step', 'Visible and semantic current resource');
  rows[0].focus(); await keyPress('Space'); await until(() => url()?.endsWith('lesson=0'), 'Space activates resource');
  rows[1].focus(); await keyPress('Enter'); await until(() => url()?.endsWith('lesson=1'), 'Enter activates resource');
  assert(getComputedStyle(rows[1]).outlineStyle !== 'none', 'Resource keyboard focus');
  const external = document.querySelector('.learning-current-resource .learning-external-action');
  assert(external?.target === '_blank' && external.rel.includes('noopener') && !external.closest('button'), 'External action separate and safe');
  await capture('learning-module');
  document.querySelector('.learning-assessment a[aria-label^="Take assessment"]').click();
  await until(() => document.querySelector('.assessment-workspace form'), 'Module to assessment');
  await until(() => document.querySelector('.assessment-review-actions a')?.textContent === 'Review module', 'Module return verified');
  document.querySelector('.assessment-review-actions a').click(); await until(() => url() === '/learning?topic=db&module=m&lesson=1' && document.querySelector('.learning-module-layout'), 'Review restores module/lesson');
  checks.push('Actual blank-space module/resource clicks, Enter/Space, current marker, separate external action and module/lesson return');

  await render('/learning?topic=db&module=paid-m'); await until(() => document.querySelector('.learning-unlock'), 'Paid module locked');
  assert(!document.querySelector('.learning-module-layout'), 'Paid body remains withheld');
  document.querySelector('#learning-tab-assessments').click(); await until(() => document.querySelector('.assessment-card a[aria-label^="Take assessment"]'), 'Hub despite locked material');
  document.querySelector('.assessment-card a[aria-label^="Take assessment"]').click(); await until(() => document.querySelector('.assessment-workspace form'), 'Direct access without viewing materials');
  document.querySelector('form button[type="submit"]').click(); await until(() => document.querySelector('#assessment-answer-error'), 'Incomplete answers');
  assert(document.activeElement.name === 'question-0' && writes === 0, 'First unanswered focus and no submit');
  const firstOption = document.querySelector('.assessment-option'); const beforeSelection = firstOption.getBoundingClientRect();
  for (const radio of document.querySelectorAll('input[type="radio"]')) if (radio.value && radio.parentElement.textContent.includes('First answer')) radio.click();
  await pause(220); const afterSelection = firstOption.getBoundingClientRect();
  assert(beforeSelection.width === afterSelection.width && beforeSelection.height === afterSelection.height, 'Answer selection never shifts layout');
  assert(firstOption.querySelector('input').checked && getComputedStyle(firstOption).borderInlineStartWidth === '4px', 'Selection has native checked state and a structural marker');
  deferSubmit = true;
  document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => releaseSubmit && document.querySelector('form[aria-busy="true"]'), 'Assessment pending');
  const pending = document.querySelector('form button[type="submit"]');
  assert(pending.disabled && pending.getAttribute('aria-busy') === 'true' && pending.textContent.includes('Submitting'), 'Assessment pending is readable and guarded');
  assert(getComputedStyle(pending, '::after').animationName === (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'none' : 'waiting-progress'), 'Pending progress respects reduced motion');
  deferSubmit = false; releaseSubmit();
  await until(() => document.querySelector('.assessment-result'), 'Submitted result');
  assert(writes === 1 && document.querySelector('.assessment-result').textContent.includes('+17 credits earned'), 'Actual submitted reward only');
  assert(document.querySelector('.assessment-result h3 svg[aria-hidden="true"]'), 'Result retains text with a decorative status icon');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) assert(getComputedStyle(document.querySelector('.assessment-result')).animationName === 'none', 'Result remains immediate without motion');
  await capture('assessment-result');
  document.querySelector('.assessment-result button').click(); await until(() => document.querySelector('.assessment-workspace form'), 'Retry supported');
  resultKind = 'repeat'; document.querySelectorAll('input[name="question-0"]')[0].click(); document.querySelectorAll('input[name="question-1"]')[0].click(); document.querySelectorAll('input[name="question-2"]')[0].click();
  document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await until(() => document.querySelector('.assessment-result'), 'Repeated result');
  assert(document.querySelector('.assessment-result').textContent.includes('No credits awarded') && !document.querySelector('.assessment-result').textContent.includes('+17'), 'No invented repeated award');
  checks.push('Direct/free assessment access despite paid materials; no completion gating; validation, actual reward and repeated result');

  await render('/assessments?open=renamed-a&topic=renamed'); await until(() => document.querySelector('.assessment-review-actions a')?.getAttribute('href') === '/learning?topic=renamed', 'Renamed governed topic by authoritative membership');
  await render('/assessments?open=a&topic=renamed'); await until(() => document.querySelector('.assessment-workspace form') && document.querySelector('.form-hint')?.textContent.includes('could not be confirmed'), 'Mismatched context rejected');
  assert(document.querySelector('.assessment-review-actions a').textContent === 'Browse learning', 'No forged return destination');
  await render('/assessments?open=legacy'); await until(() => document.querySelector('.assessment-workspace form'), 'Legacy direct route');
  assert(document.querySelector('.assessment-review-actions a').textContent === 'Browse learning', 'Legacy material discovery fallback');
  failTopics = true; await render('/assessments'); await until(() => document.querySelector('.assessment-hub-list') && document.querySelector('.alert-warning'), 'Optional topic failure');
  assert(document.querySelectorAll('.assessment-card').length === 3, 'Topic failure does not gate hub'); failTopics = false;
  failList = true; await render('/assessments?open=a'); await until(() => document.querySelector('.assessment-workspace form'), 'List failure does not gate direct access');
  await render('/assessments'); await until(() => document.querySelector('.empty-state button'), 'Hub failure retry');
  assert(!document.querySelector('.assessment-hub-list'), 'Failure is not an empty list'); failList = false;
  document.querySelector('.empty-state button').click(); await until(() => document.querySelector('.assessment-hub-list'), 'Retry recovers hub');
  failAssessment = true; await render('/learning?topic=db&module=m'); await until(() => document.querySelector('.learning-assessment [role="alert"]'), 'Unavailable contextual assessment');
  assert(!document.querySelector('.learning-assessment a[aria-label^="Take assessment"]'), 'No unavailable assessment action'); failAssessment = false;
  document.querySelector('.learning-assessment button').click(); await until(() => document.querySelector('.learning-assessment .assessment-card'), 'Context retry recovers');
  slowDetail = true; await render('/assessments?open=a'); await until(() => releaseDetail, 'Pending detail');
  document.getElementById('hub').click(); await until(() => url() === '/assessments', 'Leave pending detail'); slowDetail = false; releaseDetail(); await pause(150);
  assert(!document.querySelector('.assessment-workspace'), 'Late assessment response cannot reopen a left route');
  checks.push('Renamed/mismatched/legacy context, optional read failures, direct access on list failure, retries and stale response isolation');

  await render('/learning?view=contribute'); await until(() => document.querySelector('#learning-title'), 'Contribution');
  const title = document.querySelector('#learning-title'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(title, 'Keep my resource draft'); title.dispatchEvent(new Event('input', { bubbles: true })); await pause();
  document.querySelector('#learning-tab-assessments').click(); await until(() => document.querySelector('[role="dialog"]'), 'Unsaved resource navigation');
  [...document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent === 'Keep editing').click(); await pause();
  assert(url() === '/learning?view=contribute' && title.value === 'Keep my resource draft', 'Cancel preserves contribution draft');
  await capture('learning-contribute');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) assert(Number.parseFloat(getComputedStyle(document.querySelector('.learning-section-nav a')).transitionDuration) < .001, 'Reduced motion respected');
  assert(!requests.some(([method, path]) => method !== 'GET' && !path.startsWith('/api/assessments/')), 'No unlock/progress/session writes');
  assert(errors.length === 0, 'Runtime errors: ' + errors.join('; '));
  document.getElementById('result').textContent = `PASS: ${innerWidth}x${innerHeight} Learning/Assessment\n${checks.join('\n')}`;
  document.getElementById('result').hidden = true;
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.message + '\n' + checks.join('\n'); }
