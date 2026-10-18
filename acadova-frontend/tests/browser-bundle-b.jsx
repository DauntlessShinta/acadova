import { installUploadMock } from './fixtures/mockUploadTransport';
installUploadMock();
// Actual React/router/browser interactions; synthetic HTTP boundary. Real API/DB privacy has separate tests.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import '../src/index.css';
const sid = '507f1f77bcf86cd799439021'; const mid = '507f1f77bcf86cd799439022'; const rid = '507f1f77bcf86cd799439023'; const tid = '507f1f77bcf86cd799439024';
const actor = { _id: '507f1f77bcf86cd799439011', name: 'Synthetic Bundle B Student', email: 'synthetic@example.test', role: 'student', emailVerified: true, credits: 100, skillsToTeach: [], skillsToLearn: [], onboardingFinishedAt: '2026-10-01' };
const subject = { id: sid, name: 'Algorithms · Private study workspace', courseCode: 'ITE 314', termId: tid, moduleCount: 1, completedCount: 0 };
const module = { id: mid, _id: mid, subjectId: sid, title: 'Module 12 · Search techniques', status: 'not_started', order: 12, periodId: null };
const resources = [{ id: rid, subjectId: sid, moduleId: mid, title: 'Synthetic algorithm slides', fileName: 'synthetic-algorithms.pptx', kind: 'pptx', visibility: 'private' }];
const hash = 'a'.repeat(64); const quote = 'Binary search requires sorted input to repeatedly halve the search space.';
const prompt = 'Complete the source quotation: ____ requires sorted input to repeatedly halve the search space.';
const proof = { sourceId: hash, sourceRef: 1, sourceQuote: quote };
const plans = []; const sets = []; let serial = 100; let enabled = true; let dismissed = false; let insufficient = false; let lastSave; let generated = 0; let lastPlan;
const response = (data, status = 200, message = '') => new Response(JSON.stringify({ success: status < 400, data, message }), { status });
window.fetch = async (url, options = {}) => {
  const parsed = new URL(String(url), location.origin); const path = parsed.pathname; const method = options.method || 'GET'; const body = options.body ? JSON.parse(options.body) : null;
  if (path === '/api/users/me') return response(actor);
  if (path.startsWith('/api/notifications')) return response([]);
  if (path === '/api/academic/state') return response({ terms: [{ id: tid, startYear: 2026, endYear: 2027, semester: 'First Semester', displayName: 'SY 2026–2027 • First Semester' }], currentTermId: tid, subjects: [subject], incompleteCount: 1, needsReview: [] });
  if (path === `/api/academic/subjects/${sid}`) return response({ subject, periods: [], modules: [module], resources, studySets: sets });
  if (path === '/api/academic/plans/preferences') { enabled = body.enabled; return response({ enabled }); }
  if (path === '/api/academic/plans/nudges/dismiss') { dismissed = true; return response(null); }
  if (path === '/api/academic/plans' && method === 'GET') return response({ items: plans, subjects: [subject], nudgesEnabled: enabled, nudges: enabled && !dismissed ? [{ key: `module:${mid}`, title: 'No recorded module review: Module 12', subjectId: sid, moduleId: mid, kind: 'unreviewed' }] : [] });
  if (path === '/api/academic/plans' && method === 'POST') { lastPlan = body; const row = { ...body, id: String(++serial).padStart(24, '0'), version: 1, completed: false }; plans.push(row); return response(row, 201); }
  if (path.startsWith('/api/academic/plans/') && method === 'PATCH') { const row = plans.find(row => row.id === path.split('/').at(-1)); Object.assign(row, body, { version: row.version + 1 }); lastPlan = body; return response(row); }
  if (path === '/api/ai-study/status') return response({ enabled: true, message: 'Synthetic local QA only.', maxBytes: 5242880, maxPages: 20, maxSlides: 30, maxCards: 10, maxQuestions: 5, dailyLimit: 3, remaining: 3 - generated });
  if (path === `/api/ai-study/sources/${rid}`) return response({ resourceId: rid, sourceId: hash, subjectId: sid, moduleId: mid, name: 'synthetic-algorithms.pptx', format: 'pptx', bytes: 2048 });
  if (path === '/api/ai-study/generate-resource') {
    generated++; if (body.syntheticConsent !== true || body.mode !== 'strict_source' || body.sourceId !== hash || body.resourceId !== rid || !options.headers['Idempotency-Key']) throw new Error('Stored-source consent/identity boundary');
    if (insufficient) return response(null, 422, 'Insufficient source-supported items. No study content was saved.');
    return response({ previewId: '11111111-1111-4111-8111-111111111111', title: 'Source-exact search practice', flashcards: body.type === 'quiz' ? [] : [{ front: prompt, back: 'Binary search', ...proof }], questions: body.type === 'flashcards' ? [] : [{ prompt, options: ['Binary search', 'Linear search', 'Hash lookup', 'Tree traversal'], correctIndex: 0, explanation: quote, ...proof, optionEvidence: [proof, { ...proof, sourceRef: 2, sourceQuote: 'Linear search checks every entry in the input sequence in order.' }, { ...proof, sourceRef: 3, sourceQuote: 'Hash lookup uses a key to locate the associated stored value.' }, { ...proof, sourceRef: 4, sourceQuote: 'Tree traversal visits connected nodes in a defined exploration order.' }] }], ai: { generationMode: 'strict_source', validationVersion: 'exact_cloze_v1', sourceId: hash, sourceResourceId: rid, sourceName: 'synthetic-algorithms.pptx', sourceUnits: 4, sourceFormat: 'pptx', coverage: '1/1 source-supported question', validationNote: 'Exact extracted-text matches. Not a mastery assessment.' } });
  }
  if (path === '/api/ai-study/sets' && method === 'POST') {
    if (body.content?.questions?.[0]?.options[0] !== 'Binary search') return response(null, 400, 'Your edits no longer match the strict-source evidence. Restore exact source wording.');
    lastSave = body; const row = { id: String(++serial).padStart(24, '0'), title: body.title, subjectId: sid, moduleId: mid, sourceResourceIds: [rid], ...body.content, origin: 'ai', state: 'private', version: 1, ai: { generationMode: 'strict_source', validationVersion: 'exact_cloze_v1', sourceId: hash, sourceName: 'synthetic-algorithms.pptx', sourceFormat: 'pptx', sourceUnits: 4 }, practiceHistory: [] }; sets.push(row); return response(row, 201);
  }
  if (path.startsWith('/api/ai-study/sets/')) return response(sets.find(row => row.id === path.split('/').at(-1)));
  throw new Error(`Unexpected Bundle B fixture request: ${method} ${path}`);
};
let bridge;
export function Bridge() { const auth = useAuth(); const navigate = useNavigate(); const location = useLocation(); useEffect(() => { bridge = { auth, navigate, location }; }, [auth, navigate, location]); return null; }
const pause = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };
const until = async (condition, message) => { for (let i = 0; i < 150; i++) { if (condition()) return; await pause(); } throw new Error(message); };
const button = text => [...document.querySelectorAll('button')].find(row => row.getClientRects().length && row.textContent.trim() === text);
const fill = (selector, value) => { const input = document.querySelector(selector); assert(input, 'Missing ' + selector); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); };
const select = (selector, value) => { const input = document.querySelector(selector); input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); };
const go = async path => { bridge.navigate(path); await pause(250); };
const layout = () => { assert(document.documentElement.scrollWidth <= innerWidth + 1, 'No horizontal overflow'); for (const control of document.querySelectorAll('.academic-workspace .btn, .ai-study-page .btn')) if (control.getClientRects().length) assert(control.getBoundingClientRect().height >= 43, 'Minimum action target'); };
const capture = async name => { layout(); if (!window.__acadovaCaptureEnabled) return; window.__acadovaCapture = name; await until(() => !window.__acadovaCapture, 'Capture ' + name); };
localStorage.setItem('acadova_token', 'synthetic-bundle-b');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge /><App /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try {
  await until(() => bridge?.auth.isAuthenticated, 'Synthetic sign in'); await go('/dashboard'); await until(() => button('Add exam / goal / task'), 'Planning widget');
  button('Add exam / goal / task').click(); await until(() => document.querySelector('#plan-title'), 'Plan form'); select('#plan-kind', 'exam'); fill('#plan-title', 'My entered examination'); fill('#plan-date', '2026-10-25T09:00'); await pause(); button('Save plan entry').click(); await until(() => !document.querySelector('[role="dialog"]'), 'Plan save');
  assert(lastPlan.dueAt === new Date('2026-10-25T09:00').toISOString(), 'Device timezone converted to explicit UTC'); assert(document.body.textContent.includes('My entered examination'), 'Entered exam visible');
  button('Edit / reschedule').click(); await until(() => document.querySelector('#plan-date'), 'Reschedule form'); fill('#plan-date', '2026-10-26T10:30'); await pause(); button('Save plan entry').click(); await until(() => !document.querySelector('[role="dialog"]'), 'Rescheduled');
  await until(() => !button('Mark complete').disabled, 'Task ready'); button('Mark complete').click(); await until(() => document.body.textContent.includes('Marked complete'), 'Explicit task completion'); assert(module.status === 'not_started', 'Task completion never completes modules');
  await until(() => !button('Dismiss suggestion').disabled, 'Suggestion ready'); button('Dismiss suggestion').click(); await until(() => !button('Dismiss suggestion'), 'Dismissed suggestion'); const preference = document.querySelector('.study-plan-widget input[type="checkbox"]'); preference.click(); await until(() => !document.querySelector('.study-plan-widget input[type="checkbox"]').checked, 'Suggestions opted out');
  await capture('bundle-b-plan');
  await go(`/subjects/${sid}`); await until(() => document.querySelector('.ac-generate-menu'), 'Resource generation action'); document.querySelector('.ac-generate-menu').open = true; document.querySelector('.ac-generate-menu a[href*="format=quiz"]').click(); await until(() => document.body.textContent.includes('Stored source:') && document.querySelector('#ai-synthetic-consent'), 'Owned stored source selected');
  assert(document.body.textContent.includes('Module 12'), 'Module destination'); assert(button('Generate study material').disabled, 'Stored file still requires synthetic consent'); fill('#ai-item-count', '1'); document.querySelector('#ai-synthetic-consent').click(); await pause(); button('Generate study material').click(); await until(() => document.querySelector('#strict-q-0-option-0'), 'Source-exact preview');
  assert(document.body.textContent.includes('Source text matched'), 'Narrow source-match label'); document.querySelector('.ai-source-evidence summary').click(); assert(document.querySelector('.ai-source-evidence blockquote').textContent === quote, 'Exact quoted evidence visible'); assert(document.body.textContent.includes('Source slide 1'), 'Slide provenance visible'); await capture('bundle-b-strict-preview');
  fill('#strict-q-0-option-0', 'Unsupported paraphrase'); await pause(); assert(document.body.textContent.includes('Edited preview'), 'Edited content loses current match label'); button('Save to My Study Sets').click(); await until(() => document.body.textContent.includes('Your edits no longer match'), 'Unsupported edit rejected'); assert(document.querySelector('#strict-q-0-option-0').value === 'Unsupported paraphrase', 'Rejected edit retained'); assert(!document.querySelector('[role=dialog]'), 'Edit validation stays next to the preview');
  fill('#strict-q-0-option-0', 'Binary search'); await pause(); button('Save to My Study Sets').click(); await until(() => button('Rename set'), 'Revalidated set saved'); assert(lastSave.subjectId === sid && lastSave.moduleId === mid, 'Source set retains destination'); assert(lastSave.content.questions[0].sourceId === hash, 'Saved source identity');
  insufficient = true; await go(`/learning/ai-study?subjectId=${sid}&moduleId=${mid}&resourceId=${rid}&format=quiz`); await until(() => document.body.textContent.includes('Stored source:'), 'Source reselection'); document.querySelector('#ai-synthetic-consent').click(); await pause(); button('Generate study material').click(); await until(() => document.body.textContent.includes('Insufficient source-supported'), 'Explicit insufficient-source result'); assert(!document.querySelector('#ai-set-title'), 'No fabricated preview after insufficient output');
  insufficient = false; await go(`/learning/ai-study?subjectId=${sid}&moduleId=${mid}&resourceId=${rid}&format=flashcards`); await until(() => document.body.textContent.includes('Stored source:'), 'Flashcard resource selection'); document.querySelector('#ai-synthetic-consent').click(); await pause(); button('Generate study material').click(); await until(() => document.querySelector('#strict-card-0-answer'), 'Exact flashcard preview'); assert(document.querySelector('#strict-card-0-answer').value === 'Binary search', 'Source-preserved flashcard back'); button('Discard preview').click(); await until(() => !document.querySelector('#ai-set-title'), 'Preview discarded'); layout();
  document.getElementById('result').textContent = 'PASS: Bundle B manual exam/task planning, reschedule/complete, dismiss/opt out, stored-source consent, exact provenance preview, rejected edits retained, revalidated save, insufficient source, flashcards/discard, responsive layout.';
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.message; }
