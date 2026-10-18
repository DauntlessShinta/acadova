import { installUploadMock } from './fixtures/mockUploadTransport';
installUploadMock();
// Browser interactions use synthetic HTTP fixtures; real MongoDB authorization has separate integration tests.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import '../src/index.css';
const actor = { _id: '507f1f77bcf86cd799439011', name: 'Synthetic Student', email: 'synthetic@example.test', role: 'student', emailVerified: true, credits: 100, skillsToTeach: [], skillsToLearn: [], onboardingFinishedAt: '2026-10-01' };
let serial = 100; const nextId = () => String(++serial).padStart(24, '0');
const terms = []; const subjects = []; const periods = []; const modules = []; const resources = []; const sets = []; let currentTermId = null; let lastSave;
const response = (data, status = 200, message = '') => new Response(JSON.stringify({ success: status < 400, data, message }), { status });
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname; const method = options.method || 'GET';
  const body = options.body instanceof FormData ? options.body : options.body ? JSON.parse(options.body) : null;
  if (path === '/api/users/me') return response(actor);
  if (path.startsWith('/api/notifications')) return response([]);
  if (path === '/api/academic/state') return response({ terms, currentTermId, subjects: subjects.filter(row => row.termId === currentTermId).map(row => { const own = modules.filter(module => module.subjectId === row.id); return { ...row, completedCount: own.filter(module => module.status === 'completed').length, moduleCount: own.length }; }), incompleteCount: modules.filter(row => row.status !== 'completed').length, continueModule: modules.find(row => row.status === 'in_progress'), needsReview: [] });
  if (path === '/api/academic/current-term') { currentTermId = body.currentTermId; return response({ currentTermId }); }
  const match = /^\/api\/academic\/(terms|subjects|periods|modules|resources)(?:\/([a-f0-9]{24}))?$/.exec(path);
  if (match) {
    const [, type, id] = match; const collection = { terms, subjects, periods, modules, resources }[type];
    if (method === 'GET' && type === 'subjects') return response({ subject: subjects.find(row => row.id === id), periods: periods.filter(row => row.subjectId === id), modules: modules.filter(row => row.subjectId === id).sort((a, b) => a.order - b.order), resources: resources.filter(row => row.subjectId === id), studySets: sets.filter(row => row.subjectId === id) });
    if (method === 'POST') {
      if (body.kind === 'google_form_link' && !body.url.startsWith('https://forms.gle/')) return response(null, 400, 'Use a forms.gle or docs.google.com/forms link.');
      const row = { ...body, id: nextId(), ...(type === 'modules' ? { status: 'not_started', order: 0, ...body } : {}), ...(type === 'resources' ? { visibility: 'private' } : {}) };
      if (type === 'terms') { row.endYear = row.startYear + 1; row.displayName = `SY ${row.startYear}–${row.endYear} • ${row.semester}`; currentTermId ||= row.id; }
      collection.push(row); return response(row, 201);
    }
    if (method === 'PATCH') { const row = collection.find(row => row.id === id); Object.assign(row, body); return response(row); }
  }
  if (path === '/api/study-sets') return response(sets);
  if (path === '/api/ai-study/status') return response({ enabled: true, maxBytes: 5242880, maxPages: 20, maxSlides: 30, maxCards: 10, maxQuestions: 5, dailyLimit: 3, remaining: 3 });
  if (path === '/api/ai-study/generate') return response({ previewId: '11111111-1111-4111-8111-111111111111', title: 'Module practice', flashcards: [{ front: 'Term?', back: 'Synthetic definition.', sourceRef: 1 }], questions: [], ai: { sourceName: 'synthetic.pdf', sourceUnits: 1, sourceFormat: 'pdf' } });
  if (path === '/api/ai-study/sets' && method === 'POST') { lastSave = body; const row = { ...body, id: nextId(), flashcards: [{ front: 'Term?', back: 'Synthetic definition.', sourceRef: 1 }], questions: [], origin: 'ai', state: 'private', ai: { sourceName: 'synthetic.pdf', sourceUnits: 1 }, practiceHistory: [] }; sets.push(row); return response(row, 201); }
  if (path.startsWith('/api/ai-study/sets/')) return response(sets.find(row => row.id === path.split('/').at(-1)));
  throw new Error(`Unexpected fixture request: ${method} ${path}`);
};
let bridge;
export function Bridge() { const auth = useAuth(); const navigate = useNavigate(); const location = useLocation(); useEffect(() => { bridge = { auth, navigate, location }; }, [auth, navigate, location]); return null; }
const pause = (ms = 70) => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };
const until = async (check, message) => { for (let i = 0; i < 100; i++) { if (check()) return; await pause(); } throw new Error(message); };
const button = text => [...document.querySelectorAll('button')].find(row => row.getClientRects().length && row.textContent.trim() === text);
const fill = (selector, value) => { const input = document.querySelector(selector); assert(input, 'Missing ' + selector); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); };
const select = (selector, value) => { const input = document.querySelector(selector); input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); };
const go = async path => { bridge.navigate(path); await pause(250); };
const layout = () => { assert(document.documentElement.scrollWidth <= innerWidth + 1, 'No horizontal overflow'); for (const control of document.querySelectorAll('.academic-workspace .btn')) if (control.getClientRects().length) assert(control.getBoundingClientRect().height >= 43, 'Minimum control height'); };
const capture = async name => { layout(); if (!window.__acadovaCaptureEnabled) return; window.__acadovaCapture = name; await until(() => !window.__acadovaCapture, 'Screenshot capture'); };
const saveEditor = async () => { await pause(); button('Save').click(); await until(() => !document.querySelector('[role="dialog"]'), 'Editor saved'); };
localStorage.setItem('acadova_token', 'synthetic-fixture');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge /><App /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try {
  await until(() => bridge?.auth?.isAuthenticated, 'Fixture sign in'); await go('/dashboard'); await until(() => button('Create your first term'), 'Academic onboarding empty state'); layout();
  button('Create your first term').click(); await until(() => document.querySelector('#academic-startYear'), 'Term editor'); fill('#academic-startYear', '2026'); fill('#academic-semester', 'First Semester'); await saveEditor();
  button('Add subject').click(); await until(() => document.querySelector('#academic-name'), 'Subject editor'); fill('#academic-name', 'Advanced Database Systems'); fill('#academic-courseCode', 'ITE 314'); await saveEditor(); await until(() => document.body.textContent.includes('Advanced Database Systems'), 'Current-term subject');
  button('Add term').click(); await until(() => document.querySelector('#academic-startYear'), 'Historical term editor'); fill('#academic-startYear', '2025'); fill('#academic-semester', 'Summer'); await saveEditor();
  select('#current-term', terms[1].id); await until(() => button('Add a subject'), 'Historical term has separate empty state'); assert(!document.body.textContent.includes('Advanced Database Systems'), 'Subject hidden in other term'); select('#current-term', terms[0].id); await until(() => document.body.textContent.includes('Advanced Database Systems'), 'Original subjects preserved'); await capture('bundle-a-home');
  await go(`/subjects/${subjects[0].id}`); await until(() => button('Add examination period'), 'Subject workspace'); button('Add examination period').click(); await until(() => document.querySelector('#academic-label'), 'Period editor'); fill('#academic-label', 'Laboratory practical'); await saveEditor();
  button('Add module').click(); await until(() => document.querySelector('#academic-title'), 'Module editor'); fill('#academic-title', 'Module 12 · Query optimization'); select('#academic-periodId', periods[0].id); await saveEditor(); await until(() => document.body.textContent.includes('Module 12'), 'Custom module grouping');
  select(`#status-${modules[0].id}`, 'in_progress'); await until(() => modules[0].status === 'in_progress', 'Explicit module status');
  await until(() => !button('Attach Google Form')?.disabled, 'Resource action ready'); button('Attach Google Form').click(); await until(() => document.querySelector('#academic-url'), 'Bookmark editor'); fill('#academic-title', 'Teacher quiz'); fill('#academic-url', 'https://evil.test/quiz'); await pause(); button('Save').click(); await until(() => document.body.textContent.includes('Use a forms.gle'), 'Bookmark validation feedback'); assert(document.querySelector('#academic-title').value === 'Teacher quiz', 'Failed editor retains title'); fill('#academic-url', 'https://forms.gle/abc'); await saveEditor();
  const link = [...document.querySelectorAll('a')].find(row => row.href === 'https://forms.gle/abc'); assert(link?.target === '_blank' && link.rel.includes('noopener'), 'External link protected'); assert(document.body.textContent.includes('Scores and completion are not synced'), 'Forms does not claim scores');
  await capture('bundle-a-subject');
  const create = [...document.querySelectorAll('a')].find(row => row.textContent === 'Create AI study set'); create.click(); await until(() => document.querySelector('#ai-document') && document.body.textContent.includes('Saving to'), 'AI module context');
  assert(document.body.textContent.includes('Module 12'), 'Module destination visible');
  const dt = new DataTransfer(); dt.items.add(new File(['synthetic mocked content'], 'synthetic.pdf', { type: 'application/pdf' })); const input = document.querySelector('#ai-document'); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('#ai-synthetic-consent').click(); await pause(); button('Generate study material').click(); await until(() => document.querySelector('#ai-set-title'), 'AI preview'); const previewSaveButton = button('Save to My Study Sets'); const saveWasPending = previewSaveButton.disabled; await until(() => !previewSaveButton.disabled, 'Preview save ready after generation bookkeeping'); previewSaveButton.click(); await until(() => button('Rename set'), 'AI saved');
  assert(lastSave.subjectId === subjects[0].id && lastSave.moduleId === modules[0].id, 'AI save preserves module association');
  await go(`/subjects/${subjects[0].id}`); await until(() => document.body.textContent.includes('Module practice'), 'AI set appears in workspace');
  select(`#status-${modules[0].id}`, 'completed'); await until(() => modules[0].status === 'completed', 'Explicit completion'); await go('/dashboard'); await until(() => document.body.textContent.includes('1 of 1 modules marked complete'), 'Home reflects self-reported completion'); layout();
  document.getElementById('result').textContent = 'PASS: Bundle A term onboarding/switching, subjects, periods/modules, self-reported status, safe Forms, retained validation errors, AI module generation/save, responsive controls. Save initially disabled: ' + saveWasPending;
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.message; }
