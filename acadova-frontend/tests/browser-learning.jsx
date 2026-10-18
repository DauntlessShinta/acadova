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
  { id: 'a', learningTopic: 'db', title: 'Database Fundamentals: tables, relationships, and introductory SQL', topic: 'Database Systems', questionCount: 3 },
  { id: 'legacy', title: 'Discrete Mathematics practice', topic: 'Legacy Mathematics', questionCount: 3 },
  { id: 'renamed-a', learningTopic: 'renamed', title: 'Mathematics foundations', topic: 'Previous Mathematics Name', questionCount: 3 },
];
const resources = [
  { id: 'r1', topic: 'db', title: 'Tables and relationships', description: 'Review how a database organizes related information.', resourceType: 'text', textContent: 'A table groups related records.', creditCost: 0, locked: false },
  { id: 'r2', topic: 'db', title: 'SQL reference and practical examples', description: 'Study an external reference.', resourceType: 'url', externalUrl: 'https://example.test/sql', creditCost: 0, locked: false },
  { id: 'paid-r', topic: 'db', title: 'Advanced database exercises', description: 'A paid standalone resource.', resourceType: 'text', creditCost: 25, locked: true },
];
const module = { id: 'm', topic: 'db', title: 'Database fundamentals and guided practice', description: 'Review these resources in order.', creditCost: 0, locked: false, resources: resources.slice(0, 2), assessment: 'a' };
const paidModule = { id: 'paid-m', topic: 'db', title: 'Additional practice', description: 'Paid materials with a separate entitlement.', creditCost: 30, locked: true };
const staffAssessments = [
  { ...assessments[0], status: 'published', learningTopic: 'db', topic: 'Previous Database Name' },
  { id: 'wrong', title: 'Same name, other governed topic', status: 'published', learningTopic: 'other', topic: 'Database Systems' },
  { id: 'draft-a', title: 'Not published', status: 'draft', learningTopic: 'db', topic: 'Database Systems' },
];
const staffTopics = [...topics.map((item) => ({ ...item, status: 'published' })),
  { id: 'draft-topic', name: 'Programming Fundamentals', description: 'Prepare guided programming lessons.', status: 'draft' },
  { id: 'archived-topic', name: 'Archived topic', description: 'Historical learning material.', status: 'archived' }];
const staffResources = resources.slice(0, 2).map((item) => ({ ...item, reviewStatus: 'published' }));
staffResources.push({ ...resources[0], id: 'submission', title: 'Student database practice', reviewStatus: 'submitted',
  submittedBy: 'student', submitterName: student.name, createdAt: '2026-10-01T10:00:00.000Z' });
const staffModules = [{ ...module, status: 'draft', resources: ['r1', 'r2'] }];
let failTopicCreate = true; let failContribution = true;
const authored = [];
let savedModule; let failModuleSave = true;
let failList = false; let failTopics = false; let failAssessment = false; let failDetail = false;
let mismatchAssessment = false; let slowDetail = false; let releaseDetail; let writes = 0; let resultKind = 'pass';
let deferSubmit = false; let releaseSubmit;
const requests = [];
const completedLessons = new Set(); let failCompletion = true; let progressWrites = 0;
const moduleProgress = () => ({ module: 'm', lessons: resources.slice(0,2).map((item) => ({ resource: item.id, completed: completedLessons.has(item.id) })), assessment: { id: 'a', passed: resultKind === 'repeat' }, completedRequirements: completedLessons.size + (resultKind === 'repeat' ? 1 : 0), totalRequirements: 3, percent: Math.round((completedLessons.size + (resultKind === 'repeat' ? 1 : 0)) * 100 / 3), complete: completedLessons.size === 2 && resultKind === 'repeat' });
const response = (data, status = 200, message) => new Response(JSON.stringify({ success: status < 400, data, message }), { status });
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), 'https://fixture.test').pathname;
  requests.push([options.method || 'GET', path]);
  if (path === '/api/learning/modules/m/resources/r1/complete' && options.method === 'POST') {
    progressWrites++; if (failCompletion) return response(null, 503, 'Completion could not be saved.');
    completedLessons.add('r1'); return response({ resource: 'r1', module: 'm', completed: true, completedAt: '2026-10-14T02:00:00Z' });
  }
  if (path === '/api/learning/modules/m/progress') return response(moduleProgress());
  if (path === '/api/learning/modules/paid-m/progress') return response({ module: 'paid-m', lessons: [], completedRequirements: 0, totalRequirements: 1, percent: 0 });
  if (/^\/api\/learning\/topics\/[^/]+\/progress$/.test(path)) return response({ ...moduleProgress(), modules: path.includes('/db/') ? [moduleProgress()] : [], completedModules: 0, publishedModules: path.includes('/db/') ? 2 : 0, passedAssessments: 0, assessmentRequirements: 1 });
  if (/^\/api\/moderator\/learning\/topics\/[^/]+$/.test(path)) {
    const topic = staffTopics.find((item) => item.id === path.split('/').at(-1));
    return topic ? response({ ...topic, resources: staffResources.filter((item) => item.topic === topic.id), modules: staffModules.filter((item) => item.topic === topic.id), assessments: staffAssessments.filter((item) => Object.hasOwn(item, 'learningTopic') ? item.learningTopic === topic.id : item.topic === topic.name) }) : response(null, 404, 'Topic unavailable.');
  }
  if (/^\/api\/moderator\/assessments\/[^/]+$/.test(path)) { const item = staffAssessments.find((item) => item.id === path.split('/').at(-1)); return response({ ...item, questions: questions.map((question) => ({ ...question, correctIndex: 0 })) }); }
  if (path === '/api/moderator/learning/modules/m' && options.method === 'PATCH') {
    if (failModuleSave) return response(null, 503, 'Module could not be saved.');
    savedModule = JSON.parse(options.body); Object.assign(staffModules[0], savedModule); return response({ ...module, ...savedModule, status: 'draft' });
  }
  if (options.method === 'POST' && path === '/api/learning/resources/submit') {
    if (failContribution) return response(null, 503, 'Resource submission unavailable. Your draft is still here.');
    const body = JSON.parse(options.body);
    if (body.reviewStatus || Object.hasOwn(body, 'creditCost')) throw new Error('Student contribution contains protected fields');
    authored.push(['contribution', body]); return response({ id: 'contribution', reviewStatus: 'submitted' }, 201);
  }
  if (options.method === 'POST' && /^\/api\/moderator\/learning\/(topics|resources|modules)$/.test(path)) {
    const kind = path.split('/').at(-1); const body = JSON.parse(options.body);
    if (kind === 'topics' && failTopicCreate) return response(null, 503, 'Topic could not be created.');
    const item = { ...body, id: `new-${kind}`, ...(kind === 'resources' ? { reviewStatus: 'draft', creationOrigin: 'staff', authorRole: 'moderator', creditCost: 0, submittedBy: 'staff' } : { status: 'draft', creditCost: 0 }) };
    ({ topics: staffTopics, resources: staffResources, modules: staffModules })[kind].push(item); authored.push([kind, body]); return response(item, 201);
  }
  const staffAction = path.match(/^\/api\/moderator\/learning\/(topics|resources|modules)\/([^/]+)\/(publish|reject|archive)$/);
  if (options.method === 'POST' && staffAction) {
    const [, kind, id, action] = staffAction; const body = JSON.parse(options.body);
    const item = ({ topics: staffTopics, resources: staffResources, modules: staffModules })[kind].find((row) => row.id === id);
    if (!item) throw new Error('Unknown staff fixture content');
    authored.push([`${kind}-${action}`, body]);
    Object.assign(item, kind === 'resources' ? { reviewStatus: action === 'publish' ? 'published' : action === 'reject' ? 'rejected' : 'archived', ...(body.reason ? { reviewNote: body.reason } : {}) }
      : { status: action === 'publish' ? 'published' : 'archived' }, body);
    return response(item);
  }
  if (options.method === 'POST' && path === '/api/assessments/a/submit') {
    writes++;
    const body = JSON.parse(options.body);
    if (body.answers.length !== 3) throw new Error('Unexpected answer contract');
    const result = response({ score: resultKind === 'fail' ? 33 : 100, passed: resultKind !== 'fail',
      rewardIssued: resultKind === 'pass', creditsAwarded: resultKind === 'pass' ? 17 : 0 });
    return deferSubmit ? new Promise((resolve) => { releaseSubmit = () => resolve(result); }) : result;
  }
  if (options.method && options.method !== 'GET') throw new Error('Unexpected fixture write: ' + path);
  if (path === '/api/moderator/learning/topics') return response(staffTopics);
  if (path === '/api/moderator/learning/resources') return response(staffResources);
  if (path === '/api/moderator/learning/modules') return response(staffModules);
  if (path === '/api/moderator/assessments') return response(staffAssessments);
  if (path === '/api/assessments') return failList ? response(null, 503, 'Assessment list unavailable.') : response(assessments);
  if (path.startsWith('/api/assessments/')) {
    if (slowDetail) return new Promise((resolve) => { releaseDetail = () => resolve(response({ ...assessments[0], questions })); });
    const item = assessments.find((assessment) => assessment.id === path.split('/').at(-1));
    return failAssessment || !item ? response(null, 404, 'Assessment not available.') : response({ ...item, ...(mismatchAssessment && item.id === 'a' ? { learningTopic: 'other' } : {}), questions });
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
const fill = (selector, value) => {
  const input = document.querySelector(selector);
  const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
};
const submitForm = (form) => { assert(form.checkValidity(), 'Valid authoring form'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); };
const acceptDialog = async (label) => { await until(() => document.querySelector('[role="dialog"]'), 'Confirmation dialog'); [...document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent === label).click(); await pause(); };
const clickBackground = async (element) => {
  element.scrollIntoView({ block: 'center', behavior: 'instant' }); await pause();
  const bounds = element.getBoundingClientRect();
  window.__acadovaPointer = { x: bounds.left + 12, y: bounds.bottom - 12 };
  await until(() => !window.__acadovaPointer, 'Whole-row pointer activation'); await pause();
};
// oxlint-disable-next-line react/only-export-components
function Probe() { const location = useLocation(); const navigate = useNavigate(); return <span hidden id="probe" data-url={location.pathname + location.search + location.hash}><button id="back" onClick={() => navigate(-1)}>Back</button><button id="forward" onClick={() => navigate(1)}>Forward</button><button id="hub" onClick={() => navigate('/assessments')}>Hub</button></span>; }
const url = () => document.getElementById('probe')?.dataset.url;
async function render(path, actor = student) {
  const previous = document.getElementById('probe');
  root.render(<AuthContext.Provider value={{ user: actor, credits: 100, loading: false, isAuthenticated: true, refreshUser: async () => {}, logout: () => {} }}><ToastProvider><ConfirmProvider><MemoryRouter key={++renderKey} initialEntries={[path]}><App /><Probe /></MemoryRouter></ConfirmProvider></ToastProvider></AuthContext.Provider>);
  await until(() => document.getElementById('probe') !== previous && url() === path, 'Router commit: ' + path);
  await until(() => document.querySelector(actor.role === 'student' ? '.learning-section-nav' : '.staff-page'), 'Learning navigation'); await pause();
}
const capture = async (name, target = null) => {
  document.querySelectorAll('.app-toast button').forEach((button) => button.click());
  if (target) target.scrollIntoView({ block: 'center', behavior: 'instant' });
  else window.scrollTo({ top: 0, behavior: 'instant' });
  await pause(150);
  assert(document.documentElement.scrollWidth <= innerWidth, 'Document overflow: ' + name);
  for (const action of visible('.learning-section-nav a, .assessment-card-actions .btn, .assessment-review-actions .btn, .learning-resource-row, .learning-module-summary button, .learning-management-page .btn, .learning-management-page input, .learning-management-page select')) {
    const box = action.getBoundingClientRect();
    assert(box.height >= 43.9, 'Small action: ' + name + ' ' + action.textContent);
    if (!['INPUT', 'SELECT'].includes(action.tagName)) assert(action.scrollWidth <= action.clientWidth + 1, 'Clipped action: ' + name + ' ' + action.textContent);
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
  const sectionLinks=[...document.querySelectorAll('.learning-section-nav a')];
  assert(sectionLinks.length === 5 && !document.querySelector('.learning-section-nav [role="tab"]'), 'All five learning destinations use semantic navigation');
  for (const destination of ['/learning','/assessments','/study-sets','/learning/ai-study','/learning?view=contribute']) {
    assert(sectionLinks.some(link => link.getAttribute('href') === destination), 'Preserved learning destination: '+destination);
  }
  for (const link of document.querySelectorAll('.learning-section-nav a')) {
    const range = document.createRange(); range.selectNodeContents(link);
    if (!link.textContent.trim().includes(' ')) assert(range.getClientRects().length === 1, 'Navigation must not split a word: ' + link.textContent);
    assert(getComputedStyle(link).overflowWrap === 'normal', 'Section navigation wraps at word boundaries');
  }
  await capture('learning-library');
  const hubLink = document.querySelector('#learning-tab-assessments'); hubLink.focus(); await keyPress('Enter');
  await until(() => url() === '/assessments' && document.querySelectorAll('.assessment-card').length === 3, 'Learning to hub');
  assert(document.querySelector('#learning-tab-assessments').getAttribute('aria-current') === 'page', 'Hub section current');
  assert(document.querySelector('.learning-section-nav[aria-label="Learning sections"] a[href="/learning"]'), 'Library remains accessible in contextual learning navigation');
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
  await until(() => url()?.startsWith('/assessments?open=a') && document.querySelectorAll('.assessment-option input[name^="question-"]').length === 9, 'Contextual topic assessment');
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
  assert(document.querySelector('#learning-study-heading').textContent === 'Module curriculum', 'Curriculum heading');
  assert(document.querySelector('.learning-lesson-position').textContent === 'Lesson 1 of 2', 'Truthful lesson position');
  assert(!document.querySelector('.learning-lesson-actions a'), 'Next lesson precedes assessment on first resource');
  let curriculum = document.querySelector('.learning-curriculum');
  assert(curriculum.open === (innerWidth >= 1025), 'Curriculum defaults to expanded desktop and collapsed compact screens');
  await until(() => document.querySelector('.learning-completion-control button:not(:disabled)'), 'Completion control ready');
  assert(document.querySelector('.learning-progress').textContent.includes('0%'), 'Opening lesson does not complete it');
  document.querySelector('.learning-completion-control button').click();
  await until(() => document.querySelector('.learning-page [role="alert"]')?.textContent.includes('Completion could not be saved'), 'Completion error persists');
  assert(document.querySelector('.learning-completion-control button').textContent === 'Mark as Complete', 'Failed API does not show completed state');
  failCompletion = false;
  document.querySelector('.learning-completion-control button').click(); document.querySelector('.learning-completion-control button').click();
  await until(() => document.querySelector('.learning-completion-control button')?.textContent === 'Completed', 'Completion persisted from authoritative refresh');
  assert(progressWrites === 2 && document.querySelector('.learning-progress').textContent.includes('33%'), 'Double submission prevented, exact requirements counted');
  await render('/learning?topic=db&module=m&lesson=0');
  await until(() => document.querySelector('.learning-completion-control button')?.textContent === 'Completed', 'Refresh retains completion');
  checks.push('Explicit completion, retained failure, duplicate submission guard, backend counts and persistent refresh');
  curriculum = document.querySelector('.learning-curriculum');
  await capture('learning-reading');
  if (!curriculum.open) { curriculum.querySelector('summary').focus(); await keyPress('Enter'); await until(() => curriculum.open, 'Keyboard expands curriculum'); }
  assert(!document.querySelector('.is-curriculum-row .learning-resource-description'), 'Curriculum does not repeat lesson descriptions');
  const rows = document.querySelectorAll('.learning-resource-order .learning-resource-row');
  await clickBackground(rows[1]); await until(() => url()?.endsWith('lesson=1') && document.querySelector('.learning-current-resource h2').textContent === resources[1].title, 'Whole resource row opens');
  assert(rows[1].textContent.includes('Current resource') && rows[1].getAttribute('aria-current') === 'step', 'Visible and semantic current resource');
  assert(document.querySelector('.learning-lesson-position').textContent === 'Lesson 2 of 2', 'Last lesson position');
  assert(document.querySelector('.learning-lesson-actions a')?.getAttribute('href') === '#learning-assessment-heading', 'Last lesson leads to assessment availability');
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
  const firstOption = document.querySelector('input[name="question-0"]').closest('.assessment-option'); const beforeSelection = firstOption.getBoundingClientRect();
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
  mismatchAssessment = true;
  await render('/learning?topic=db&module=m');
  await until(() => document.querySelector('.learning-assessment [role="alert"]')?.textContent.includes('no longer matches'), 'Stale cross-Topic attachment withheld');
  assert(!document.querySelector('.learning-assessment a[aria-label^="Take assessment"]'), 'Wrong-Topic attachment is not presented as Module assessment');
  await render('/assessments?open=a&topic=db&module=m');
  await until(() => document.querySelector('.assessment-workspace form') && document.querySelector('.form-hint')?.textContent.includes('could not be confirmed'), 'Manipulated return context rejected');
  assert(document.querySelector('.assessment-review-actions a').textContent === 'Browse learning', 'No false Module return; standalone free questions remain available');
  mismatchAssessment = false;
  checks.push('Renamed/mismatched/legacy context, optional read failures, direct access on list failure, retries and stale response isolation');

  await render('/learning?view=contribute'); await until(() => document.querySelector('#learning-title'), 'Contribution');
  const title = document.querySelector('#learning-title'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(title, 'Keep my resource draft'); title.dispatchEvent(new Event('input', { bubbles: true })); await pause();
  document.querySelector('#learning-tab-assessments').click(); await until(() => document.querySelector('[role="dialog"]'), 'Unsaved resource navigation');
  [...document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent === 'Keep editing').click(); await pause();
  assert(url() === '/learning?view=contribute' && title.value === 'Keep my resource draft', 'Cancel preserves contribution draft');
  await capture('learning-contribute');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) assert(Number.parseFloat(getComputedStyle(document.querySelector('.learning-section-nav a')).transitionDuration) < .001, 'Reduced motion respected');
  assert(!requests.some(([method, path]) => method !== 'GET' && !path.startsWith('/api/assessments/') && !path.endsWith('/complete')), 'No unlock/session writes');
  await render('/moderator/learning#manage-panel-modules', { ...student, role: 'moderator' });
  await until(() => document.querySelector('#manage-panel-modules .learning-management-item button'), 'Staff module ready');
  assert(document.querySelector('.learning-authoring-guide ol').children.length === 4, 'Authoring prerequisites are explicit');
  document.querySelector('#manage-panel-modules .learning-management-item button').click(); await pause();
  const picker = document.getElementById('module-assessment');
  assert([...picker.options].map((option) => option.value).join('|') === '|a', 'Governed ID matches despite old text; wrong-topic and draft assessments excluded');
  assert(document.querySelector('button[aria-label="Move up: Tables and relationships"]').disabled, 'First lesson cannot move up');
  const move = document.querySelector('button[aria-label="Move up: SQL reference and practical examples"]');
  move.focus(); assert(document.activeElement === move, 'Reorder control receives keyboard focus'); await keyPress('Enter');
  await until(() => document.querySelector('.learning-lesson-editor li strong')?.textContent === resources[1].title, 'Keyboard lesson reordering');
  assert(document.querySelector('button[aria-label="Move down: Tables and relationships"]').disabled, 'Last lesson cannot move down');
  await capture('learning-staff-lesson-order', document.querySelector('.learning-lesson-editor'));
  const moduleForm = picker.closest('form');
  moduleForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => [...document.querySelectorAll('.app-toast')].some((toast) => toast.textContent.includes('Module could not be saved')), 'Save failure feedback');
  assert(document.querySelector('.learning-lesson-editor li strong').textContent === resources[1].title && picker.value === 'a', 'Save failure retains order and assessment');
  failModuleSave = false;
  moduleForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await until(() => savedModule && document.querySelector('.learning-editor-panel') && document.getElementById('module-title').value === '', 'Saved curriculum resets editor');
  assert(savedModule.resources.join('|') === 'r2|r1' && savedModule.assessment === 'a', 'Saved order and assessment reach existing API');
  document.querySelector('#manage-panel-modules .learning-editor-heading button').click(); await pause();
  assert(document.activeElement.id === 'learning-create-modules', 'Hiding editor restores focus to its toolbar action');
  await capture('learning-staff-modules');
  await render('/moderator/learning', { ...student, role: 'moderator' });
  await until(() => document.querySelector('#staff-topic-editor') && document.querySelector('#manage-panel-topics .learning-management-item'), 'Topic split workspace');
  assert(document.getElementById('staff-topic-editor').getBoundingClientRect().top < document.querySelector('#manage-panel-topics .learning-management-item').getBoundingClientRect().top, 'Topic form precedes list regardless of content length');
  assert(!document.querySelector('.learning-authoring-guide').open, 'Guide is compact by default');
  await capture('learning-staff-topics');
  const relatedResources = [...document.querySelectorAll('#manage-panel-topics .learning-management-item')].find((row) => row.textContent.includes('Database Systems'));
  [...relatedResources.querySelectorAll('button')].find((button) => button.textContent === 'Open Topic').click();
  await until(() => document.querySelector('#manage-tab-assessments') && document.querySelector('#manage-panel-modules .learning-management-item'), 'Unified workspace opens');
  document.getElementById('manage-tab-resources').click();
  await until(() => url().endsWith('#manage-panel-resources') && document.querySelectorAll('#manage-panel-resources .learning-management-item').length === 3, 'Topic action opens all actual resources in that topic');
  document.querySelector('a[href="/moderator/learning#manage-panel-topics"]').click(); await until(() => document.getElementById('staff-topic-editor'), 'Return to topic list');
  fill('#manage-panel-topics input[type="search"]', 'Database'); await pause();
  assert(document.querySelectorAll('#manage-panel-topics .learning-management-item').length === 1, 'Topic search uses real loaded rows');
  fill('#manage-panel-topics input[type="search"]', ''); await pause();
  document.getElementById('learning-create-topics').click(); await pause();
  assert(document.activeElement.id === 'topic-name', 'Create Topic focuses the visible form');
  assert(!document.getElementById('staff-topic-editor').checkValidity(), 'Required topic fields preserved');
  fill('#topic-name', 'Data Analysis'); fill('#topic-description', 'Understand practical data analysis.'); await pause();
  submitForm(document.getElementById('staff-topic-editor'));
  await until(() => visible('.learning-management-page [role="alert"]').some((node) => node.textContent.includes('Topic could not be created')), 'Persistent creation failure');
  assert(document.getElementById('topic-name').value === 'Data Analysis', 'Failed create retains draft');
  failTopicCreate = false; submitForm(document.getElementById('staff-topic-editor'));
  await until(() => staffTopics.some((item) => item.id === 'new-topics') && document.getElementById('topic-name').value === '', 'Topic draft saved');
  const topicRow = [...document.querySelectorAll('#manage-panel-topics .learning-management-item')].find((row) => row.textContent.includes('Data Analysis'));
  const publishTopic = [...topicRow.querySelectorAll('button')].find((button) => button.textContent === 'Publish');
  publishTopic.click(); await acceptDialog('Cancel');
  assert(!authored.some(([kind]) => kind === 'topics-publish'), 'Publish cancel causes no mutation');
  publishTopic.click(); await acceptDialog('Publish topic');
  await until(() => staffTopics.find((item) => item.id === 'new-topics').status === 'published', 'Topic published');
  await until(() => !document.getElementById('learning-create-resources').disabled, 'Publication finished before opening resource editor');
  document.getElementById('learning-create-resources').click();
  await until(() => document.activeElement.id === 'staff-resource-title', 'Create Resource focus');
  [...document.querySelectorAll('.learning-review-filters button')].find((button) => button.textContent.startsWith('Awaiting review')).click(); await pause();
  fill('#staff-resource-topic', 'db'); fill('#staff-resource-title', 'SQL joins'); fill('#staff-resource-description', 'Learn how related tables connect.'); fill('#staff-resource-text', 'A JOIN combines rows from related tables.'); await pause();
  const resourceEditor = document.querySelector('[aria-label="Resource editor"]');
  resourceEditor.querySelector('.learning-editor-heading button').click(); await pause();
  document.getElementById('learning-create-resources').click(); await pause();
  assert(document.getElementById('staff-resource-title').value === 'SQL joins', 'Hide/show retains resource draft');
  submitForm(document.querySelector('[aria-label="Resource editor"] form'));
  await until(() => staffResources.some((item) => item.id === 'new-resources') && document.getElementById('staff-resource-title').value === '', 'Resource created for review');
  document.querySelector('[aria-label="Resource editor"] .learning-editor-heading button').click(); await pause();
  const resourceRow = [...document.querySelectorAll('#manage-panel-resources .learning-management-item')].find((row) => row.textContent.includes('SQL joins'));
  resourceRow.querySelector('button').click(); await pause();
  const reviewPanel = document.getElementById('resource-review-new-resources');
  reviewPanel.querySelector('details').open = true; await pause();
  assert(reviewPanel.textContent.includes('A JOIN combines rows'), 'Real lesson preview remains available');
  await capture('learning-staff-resource-review', reviewPanel);
  [...reviewPanel.querySelectorAll('button')].find((button) => button.textContent === 'Publish draft').click(); await acceptDialog('Publish resource');
  await until(() => staffResources.find((item) => item.id === 'new-resources').reviewStatus === 'published', 'Resource approved');
  await until(() => !document.getElementById('learning-create-resources').disabled, 'Publication finished');
  [...document.querySelectorAll('.learning-review-filters button')].find((button) => button.textContent.startsWith('Awaiting review')).click(); await pause();
  await until(() => document.querySelectorAll('#manage-panel-resources .learning-management-item').length === 1, 'Review queue remains separate');
  const pendingRow = document.querySelector('#manage-panel-resources .learning-management-item');
  pendingRow.querySelector('button').click(); await pause(); fill('#reject-submission', 'Add a worked example before publication.'); await pause();
  document.querySelector('#resource-review-submission .btn-danger').click(); await acceptDialog('Reject resource');
  await until(() => staffResources.find((item) => item.id === 'submission').reviewStatus === 'rejected', 'Rejection feedback sent');
  await until(() => !document.getElementById('learning-create-modules').disabled, 'Rejection finished before opening module editor');
  assert(authored.find(([kind]) => kind === 'resources-reject')[1].reason.includes('worked example'), 'Existing feedback contract preserved');
  document.getElementById('learning-create-modules').click(); await until(() => document.activeElement.id === 'module-title', 'Create Module focus');
  fill('#module-topic', 'db'); fill('#module-title', 'Database joins module'); fill('#module-description', 'Study joins, then assess your understanding.'); await pause();
  const newModuleForm = document.querySelector('[aria-label="Module editor"] form');
  [...newModuleForm.querySelectorAll('button')].find((button) => button.textContent === 'Add Tables and relationships').click(); await pause(); fill('#module-assessment', 'a'); await pause();
  submitForm(newModuleForm); await until(() => staffModules.some((item) => item.id === 'new-modules') && document.getElementById('module-title').value === '', 'New module created');
  document.querySelector('[aria-label="Module editor"] .learning-editor-heading button').click(); await pause();
  fill('#module-price-new-modules', '25'); await pause();
  const newModuleRow = [...document.querySelectorAll('#manage-panel-modules .learning-management-item')].find((row) => row.textContent.includes('Database joins module'));
  [...newModuleRow.querySelectorAll('button')].find((button) => button.textContent === 'Publish').click(); await acceptDialog('Publish module');
  await until(() => staffModules.find((item) => item.id === 'new-modules').status === 'published', 'New module published');
  await until(() => !document.getElementById('learning-create-modules').disabled, 'Module publication finished');
  assert(authored.find(([kind]) => kind === 'modules')[1].assessment === 'a' && authored.find(([kind]) => kind === 'modules-publish')[1].creditCost === 25, 'Assessment attachment and configured publication cost use existing APIs');
  await capture('learning-staff-modules-published');
  checks.push('Immediate staff creation, search, retained drafts, confirmation cancel, resource preview/approve/reject and new module publication');
  await render('/learning?view=contribute'); await until(() => document.getElementById('learning-title'), 'Student contribution form');
  fill('#learning-topic', 'db'); fill('#learning-title', 'Database reading guide'); fill('#learning-description', 'Practice with an accessible database guide.'); fill('#learning-text', 'Read the guide and practice a simple query.'); await pause();
  submitForm(document.getElementById('learning-title').closest('form'));
  await until(() => document.querySelector('.learning-contribution [role="alert"]'), 'Contribution persistent error');
  assert(document.getElementById('learning-text').value.includes('simple query'), 'Failed contribution retains content');
  failContribution = false; submitForm(document.getElementById('learning-title').closest('form'));
  await until(() => document.querySelector('.learning-contribution .alert-success'), 'Contribution pending-review outcome');
  assert(document.getElementById('learning-title').value === '' && document.querySelector('.learning-contribution .alert-success').textContent.includes('awaiting review'), 'Submission resets with honest review message');
  await capture('learning-contribution-pending');
  await render('/admin/assessments', { ...student, role: 'admin' });
  await until(() => document.querySelector('a[href="/admin/learning#manage-panel-modules"]'), 'Admin assessment return stays in Admin');
  await render('/moderator/learning?topic=db#manage-panel-modules', { ...student, role: 'moderator' });
  await until(() => document.querySelector('#manage-panel-modules .learning-management-item'), 'Direct Topic workspace');
  assert(document.querySelector('.staff-page-header h1').textContent === 'Database Systems', 'Real Topic header');
  assert(document.querySelector('.learning-topic-heading .badge')?.textContent === 'Published', 'Actual status beside title');
  assert(!document.querySelector('.learning-create-toolbar') && !document.querySelector('.learning-authoring-guide'), 'No competing permanent actions or guide in Topic header');
  assert(document.querySelector('.staff-page-header').nextElementSibling.classList.contains('learning-management-toolbar'), 'Topic tabs directly below header');
  assert(visible('#learning-create-modules').length === 1 && visible('#learning-create-resources').length === 0, 'Module creation is contextual');
  await capture('topic-modules-refined');

  document.getElementById('manage-tab-assessments').focus(); await keyPress('Enter');
  await until(() => url().endsWith('#manage-panel-assessments'), 'Topic identity persists across tabs');
  assert(document.querySelector('#manage-panel-assessments').textContent.includes('Not published') && !document.querySelector('#manage-panel-assessments').textContent.includes('Same name, other governed topic'), 'All statuses, governed ID isolation');
  assert(visible('#learning-create-modules, #learning-create-resources').length === 0 && visible('#manage-panel-assessments a.btn-primary').length === 1, 'Assessment creation is contextual');
  await capture('topic-assessments');
  document.getElementById('back').click(); await until(() => url().endsWith('#manage-panel-modules'), 'Back restores Topic tab');
  document.getElementById('forward').click(); await until(() => url().endsWith('#manage-panel-assessments'), 'Forward restores Topic tab');
  document.querySelector('#manage-panel-assessments a.btn-primary').click();
  await until(() => document.querySelector('#assessment-learning-topic')?.value === 'db', 'Existing assessment authoring prefilled');
  assert(document.getElementById('assessment-topic').value === 'Database Systems', 'Assessment Topic metadata prefilled');
  document.querySelector('a[href="/moderator/learning?topic=db#manage-panel-assessments"]').click();
  await until(() => document.getElementById('manage-tab-settings'), 'Authoring returns to governing Topic');
  document.getElementById('manage-tab-settings').focus(); await keyPress('ArrowLeft');
  assert(document.activeElement.id === 'manage-tab-assessments', 'Topic tabs keyboard navigation');
  await render('/moderator/learning?topic=renamed#manage-panel-resources', { ...student, role: 'moderator' });
  await until(() => document.querySelector('.staff-page-header h1')?.textContent === 'Advanced Mathematics', 'Different Topic refresh');
  assert(document.querySelectorAll('#manage-panel-resources .learning-management-item').length === 0, 'Different Topic never mixes resources');
  assert(document.querySelector('#manage-panel-resources .learning-table-empty').textContent.includes('No resources have been added') && visible('#learning-create-resources').length === 1, 'Accurate Resource empty state and contextual action');
  await capture('topic-empty-resources');
  document.getElementById('manage-tab-modules').click(); await until(() => visible('#learning-create-modules').length === 1, 'Module tab committed');
  assert(document.querySelector('#manage-panel-modules .learning-table-empty').textContent.includes('No learning modules are available') && visible('#learning-create-modules').length === 1, 'Accurate Module empty state and contextual action');
  await capture('topic-empty-modules');
  document.getElementById('manage-tab-assessments').click(); await until(() => visible('#manage-panel-assessments a.btn-primary').length === 1, 'Assessment tab committed');
  assert(document.querySelector('#manage-panel-assessments .learning-table-empty').textContent.includes('No assessments are available') && visible('#manage-panel-assessments a.btn-primary').length === 1, 'Accurate Assessment empty state and contextual action');
  await capture('topic-empty-assessments');
  document.getElementById('manage-tab-settings').click(); await until(() => document.getElementById('manage-tab-settings').getAttribute('aria-selected') === 'true', 'Settings tab committed');
  assert(visible('#learning-create-modules, #learning-create-resources, #manage-panel-assessments a.btn-primary').length === 0, 'Topic Settings exposes only management actions');
  await capture('topic-settings-refined');

  checks.push('Compact Topic title/status/breadcrumb, contextual actions and honest empty Modules/Resources/Assessments; mismatched Student association rejected');
  checks.push('Unified Topic direct navigation/refresh, five sections, assessment prefill, Topic return, Back/Forward and Topic isolation');
  checks.push('Staff curriculum guidance, governed picker, keyboard reorder, retained failed save, persisted order and Admin return');
  assert(errors.length === 0, 'Runtime errors: ' + errors.join('; '));
  document.getElementById('result').textContent = `PASS: ${innerWidth}x${innerHeight} Learning/Assessment\n${checks.join('\n')}`;
  document.getElementById('result').hidden = true;
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.message + '\n' + checks.join('\n'); }
