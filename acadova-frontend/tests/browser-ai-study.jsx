import { installUploadMock } from './fixtures/mockUploadTransport';
installUploadMock();
// Real Chrome + React/router; synthetic HTTP responses. Database/API behavior has separate integration tests.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import '../src/index.css';
const actor = { _id: '507f1f77bcf86cd799439011', name: 'Synthetic AI Student', email: 'synthetic@example.test', role: 'student', emailVerified: true, credits: 100, skillsToTeach: [], skillsToLearn: [], onboardingFinishedAt: '2026-10-01' };
const id = '507f1f77bcf86cd799439021'; let saved; let enabled = true; let failGeneration = true; let failSave = true; let failRename = true; let requests = 0; const writes = [];
const content = { previewId: '11111111-1111-4111-8111-111111111111', title: 'Synthetic binary search practice',
  flashcards: [{ front: 'What input does binary search require?', back: 'Sorted input.', sourceRef: 1 }, { front: 'How is the search space reduced?', back: 'It is halved repeatedly.', sourceRef: 2 }],
  questions: [{ prompt: 'Which input is required?', options: ['Sorted input', 'No input', 'An image', 'Unsorted input'], correctIndex: 0, explanation: 'The synthetic notes specify sorted input.', sourceRef: 1 }, { prompt: 'How does binary search narrow the search?', options: ['Expands it', 'Halves it', 'Skips sorting', 'Always checks every item'], correctIndex: 1, explanation: 'The search space is halved.', sourceRef: 2 }],
  ai: { sourceName: 'synthetic-notes.pdf', sourceFormat: 'pdf', sourceUnits: 2, limitation: 'Verify AI answers against your synthetic source.' }, expiresAt: new Date(Date.now() + 1800000).toISOString() };
const response = (data, status = 200, message = '') => new Response(JSON.stringify({ success: status < 400, data, message }), { status });
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname; const method = options.method || 'GET';
  const body = options.body instanceof FormData ? options.body : options.body ? JSON.parse(options.body) : null;
  if (path === '/api/users/me') return response(actor);
  if (path.startsWith('/api/notifications')) return response([]);
  if (path === '/api/ai-study/status') return response({ enabled, message: enabled ? 'Synthetic-document local QA only.' : 'Generation is disabled.', maxBytes: 5242880, maxPages: 20, maxSlides: 30, maxCards: 10, maxQuestions: 5, dailyLimit: 3, remaining: 3 - requests, maxSets: 30 });
  if (method !== 'GET') writes.push(path);
  if (path === '/api/ai-study/generate') {
    requests++;
    if (!(body instanceof FormData) || body.get('syntheticConsent') !== 'true' || body.get('mode') !== 'standard' || options.headers['Content-Type'] !== undefined || !options.headers.Authorization || !options.headers['Idempotency-Key']) throw new Error('Multipart/auth/idempotency boundary failed');
    await new Promise(resolve => setTimeout(resolve, 150));
    if (failGeneration) return response(null, 503, 'Synthetic Gemini unavailable. Retry manually.');
    return response(content);
  }
  if (path === '/api/ai-study/sets' && body) {
    if (failSave) return response(null, 503, 'Synthetic save unavailable. Preview retained.');
    saved = { ...content, ...body.content, id, title: body.title, origin: 'ai', state: 'private', version: 1, practiceHistory: [], createdAt: '2026-10-15T00:00:00Z' }; return response(saved, 201);
  }
  if (path === '/api/ai-study/sets') return response(saved ? [saved] : []);
  if (path === '/api/study-sets') return response(saved ? [saved] : []);
  if (path === '/api/ai-study/sets/' + id) {
    if (!saved) return response(null, 404, 'Private AI study set not found.');
    if (body) { if (failRename) return response(null, 503, 'Synthetic rename unavailable. Title retained.'); saved = { ...saved, title: body.title, version: saved.version + 1 }; }
    return response(saved);
  }
  if (path === `/api/ai-study/sets/${id}/practice`) {
    const correct = body.answers.filter((answer, index) => answer === saved.questions[index].correctIndex).length;
    const score = Math.round(correct * 100 / saved.questions.length); saved.practiceHistory.push({ at: new Date().toISOString(), correct, score, total: saved.questions.length });
    return response({ correct, score, total: saved.questions.length, creditsAwarded: 0, practiceHistory: saved.practiceHistory });
  }
  if (path === `/api/ai-study/sets/${id}/delete`) { saved = null; return response(null); }
  throw new Error('Unexpected request (official flow must remain untouched): ' + path);
};
let bridge;
export function Bridge() { const auth = useAuth(); const navigate = useNavigate(); const location = useLocation(); useEffect(() => { bridge = { auth, navigate, location }; }, [auth, navigate, location]); return null; }
const pause = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const until = async (condition, message) => { for (let i = 0; i < 100; i++) { if (condition()) return; await pause(); } throw new Error(message); };
const button = text => [...document.querySelectorAll('button')].find(el => el.getClientRects().length && el.textContent.trim() === text);
const fill = (selector, value) => { const el = document.querySelector(selector); assert(el, 'Missing input ' + selector); Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
const go = async path => { bridge.navigate(path); await pause(200); };
const key = async value => { window.__acadovaKey = value; await until(() => !window.__acadovaKey, 'Native key ' + value); await pause(); };
const layout = () => { assert(document.documentElement.scrollWidth <= innerWidth + 1, 'Horizontal overflow'); for (const el of document.querySelectorAll('.ai-study-page .btn')) { if (el.getClientRects().length) assert(el.getBoundingClientRect().height >= 43, 'Small touch target'); } };
const capture = async name => { layout(); if (!window.__acadovaCaptureEnabled) return; window.__acadovaCapture = name; await until(() => !window.__acadovaCapture, 'Capture ' + name); };
const pickFile = name => { const dt = new DataTransfer(); dt.items.add(new File(['Synthetic mocked PDF boundary'], name, { type: 'application/pdf' })); const input = document.querySelector('#ai-document'); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); };
localStorage.setItem('acadova_token', 'synthetic-fixture');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge /><App /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try {
  await until(() => bridge?.auth.isAuthenticated, 'Authenticated synthetic Student'); await go('/learning/ai-study'); await until(() => button('Generate study material'), 'AI Tools');
  assert(!document.querySelector('.student-utility-bar')?.textContent.includes('Page not found'), 'Learning shell recognizes AI route');
  assert(document.querySelector('a.staff-nav-link[href="/study-sets"]')?.getAttribute('aria-current') === 'page', 'Study Sets primary navigation selected for AI study tools');
  assert(button('Generate study material').disabled, 'Upload and synthetic consent required'); assert(document.body.textContent.includes('Unpaid API content'), 'Privacy disclosure'); await capture('ai-upload');
  pickFile('unsupported.txt'); await until(() => document.body.textContent.includes('Choose a nonempty PDF'), 'Invalid format error');
  pickFile('synthetic-notes.pdf'); const mode = document.getElementById('ai-source-mode'); mode.value = 'standard'; mode.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('ai-synthetic-consent').click(); await pause();
  button('Generate study material').focus(); await key('Enter'); await until(() => document.body.textContent.includes('Synthetic Gemini unavailable'), 'Recoverable provider failure');
  assert(document.body.textContent.includes('synthetic-notes.pdf'), 'File retained after provider failure'); assert(document.querySelector('[role="dialog"]'), 'Immediate provider failure dialog'); assert(!document.querySelector('.ai-generation-tray'), 'No duplicate error tray'); failGeneration = false; button('Close').click(); await until(() => !document.querySelector('[role="dialog"]'), 'Failure acknowledged without retry');
  const generate = button('Generate study material'); generate.click(); generate.click(); await until(() => document.getElementById('ai-set-title'), 'Generated preview'); assert(requests === 2, 'Double click makes one request');
  fill('#ai-set-title', 'My private binary search practice'); fill('#standard-explanation-0', 'The synthetic notes specify sorted input. Reviewed against the source.'); await pause(); button('Save to My Study Sets').click(); await until(() => document.body.textContent.includes('Synthetic save unavailable'), 'Retained failed save'); assert(document.getElementById('ai-set-title').value === 'My private binary search practice', 'Preview title retained'); assert(document.querySelector('[role="dialog"]'), 'Save failure dialog');
  failSave = false; button('Try Again').click(); await until(() => button('Rename set'), 'Saved set opened'); assert(saved.questions[0].explanation.endsWith('Reviewed against the source.'), 'Standard preview edit persists through save retry'); assert(saved.questions[0].sourceRef === 1, 'Standard edit preserves source reference');
  assert(!button('Submit for public review'), 'No AI publication action'); document.querySelector('.ai-flashcard').focus(); await key('Enter'); assert(document.querySelector('.ai-flashcard').textContent === 'Sorted input.', 'Keyboard flip');
  await key('ArrowRight'); assert(document.querySelector('.ai-flashcard').textContent.includes('How is'), 'Keyboard next card resets answer'); assert(document.querySelector('.ai-flashcards').textContent.includes('Source page 2'), 'Source reference');
  button('Restart cards').click(); await pause(); assert(document.querySelector('.ai-flashcards').textContent.includes('Card 1 of 2'), 'Restart cards'); await capture('ai-saved-practice');
  assert(button('Check answer').disabled, 'Unanswered question blocked'); document.querySelector('input[name="ai-answer-0"]').click(); await pause(); button('Check answer').click(); await until(() => document.querySelector('.ai-feedback'), 'Answer explanation');
  assert(document.querySelector('.ai-feedback').textContent.includes('synthetic notes'), 'Grounded explanation rendered'); button('Next question').click(); await pause(); document.querySelectorAll('input[name="ai-answer-1"]')[1].click(); await pause(); button('Check answer').click(); await pause(); button('Finish practice quiz').click(); await until(() => document.querySelector('.ai-score')?.textContent.includes('100%'), 'AI practice score'); await capture('ai-quiz-result');
  button('Retry practice quiz').click(); await pause(); assert(button('Check answer').disabled, 'Retake resets answers');
  button('Rename set').click(); await pause(); fill('#ai-rename-title', 'Renamed AI practice'); await pause(); button('Save title').click(); await until(() => document.body.textContent.includes('Synthetic rename unavailable'), 'Rename failure'); assert(document.querySelector('#ai-rename-title').value === 'Renamed AI practice', 'Rename draft retained'); failRename = false; button('Save title').click(); await until(() => document.querySelector('h1').textContent === 'Renamed AI practice', 'Rename persists');
  await go('/learning/ai-study?view=mine'); await until(() => document.querySelector('.ai-saved-card'), 'Saved listing'); assert(document.querySelector('.ai-saved-card').textContent.includes('2 cards · 2 questions'), 'Real saved counts'); await capture('ai-my-sets');
  document.querySelector('.ai-saved-card a').click(); await until(() => button('Rename set'), 'Reopen saved content'); assert(document.querySelector('h1').textContent === 'Renamed AI practice', 'Saved title reload');
  enabled = false; await go('/learning/ai-study'); await until(() => document.body.textContent.includes('Generation is disabled'), 'Disabled UI'); assert(button('Generate study material').disabled, 'Provider-disabled generation blocked'); await capture('ai-disabled');
  await go('/learning/ai-study?view=mine'); await until(() => document.querySelector('.ai-saved-card'), 'Saved list during outage'); document.querySelector('.ai-saved-card a').click(); await until(() => button('Delete set'), 'Saved detail during outage');
  button('Delete set').click(); await until(() => document.querySelector('[role="dialog"]'), 'Delete confirmation'); await capture('ai-delete-confirm'); const dialog = document.querySelector('[role="dialog"]'); [...dialog.querySelectorAll('button')].find(el => el.textContent.trim() === 'Delete set').click();
  await until(() => document.body.textContent.includes('No saved AI study sets yet'), 'Deleted saved set'); layout(); await capture('ai-empty');
  assert(actor.credits === 100 && writes.every(path => path.startsWith('/api/ai-study/')), 'No credits or official endpoints modified');
  document.getElementById('result').textContent = `PASS: ${innerWidth}px upload/privacy/invalid format/provider retry/multipart boundary/double click; preview save failure/retry; saved reload/rename/delete; keyboard flip/navigation/restart; unanswered guard/explanation/scoring/retake; disabled generation and accessible saved sets; zero credits, no official endpoints; responsive layout and 44px controls`;
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.message; }
