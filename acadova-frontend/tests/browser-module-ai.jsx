// Real React/router integration with a synthetic HTTP boundary. No real provider/DB.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import '../src/index.css';

const sid = '507f1f77bcf86cd799439021', mid = '507f1f77bcf86cd799439022', rid = '507f1f77bcf86cd799439023';
const mid2 = '507f1f77bcf86cd799439025', rid2 = '507f1f77bcf86cd799439026';
const actor = { _id: '507f1f77bcf86cd799439011', name: 'Synthetic module Student', email: 'module@example.test', role: 'student', emailVerified: true, credits: 100, onboardingFinishedAt: '2026-10-01', skillsToTeach: [], skillsToLearn: [] };
const subject = { id: sid, name: 'Synthetic private subject', termId: '507f1f77bcf86cd799439024' };
const modules = [{ id: mid, subjectId: sid, title: 'Source module', status: 'not_started', periodId: null }, { id: mid2, subjectId: sid, title: 'Another module', status: 'not_started', periodId: null }];
const resources = [{ id: rid, subjectId: sid, moduleId: mid, title: 'Authorized synthetic source', kind: 'pdf' }, { id: rid2, subjectId: sid, moduleId: mid2, title: 'Another private source', kind: 'pptx' }];
const sets = JSON.parse(sessionStorage.getItem('module-ai-sets') || '[]');
const phase = sessionStorage.getItem('module-ai-phase');
const refreshed = phase === 'refresh';
const recoveryPreview = JSON.parse(sessionStorage.getItem('module-ai-recovery') || 'null');
let recoveryReads = 0;
let enabled = !refreshed, failGenerate = false, failSave = false, deferGeneration = false, releaseGeneration;
let latestPreview, lastSave, generationRequests = [], saveRequests = 0;
const persistSets = () => sessionStorage.setItem('module-ai-sets', JSON.stringify(sets));
function savePreview(body) {
  saveRequests++; lastSave = body;
  if (failSave) return null;
  const resource = resources.find(row => row.id === latestPreview.ai.sourceResourceId);
  let row = sets.find(row => row.previewId === latestPreview.previewId);
  if (!row) { row = { ...latestPreview, ...(body.content || {}), id: String(30 + sets.length).padStart(24, '0'), title: body.title, subjectId: sid, moduleId: resource.moduleId, sourceResourceIds: [resource.id], origin: 'ai', state: 'private', version: 1, archivedAt: null, practiceHistory: [] }; sets.push(row); persistSets(); }
  return row;
}
const fingerprint = 'a'.repeat(64), quote = 'Binary search requires sorted input.';
const proof = { sourceId: fingerprint, sourceRef: 1, sourceQuote: quote };
const content = type => ({
  flashcards: type === 'quiz' ? [] : [{ front: 'Complete: ____ requires sorted input.', back: 'Binary search', ...proof }, { front: 'Complete: Binary search requires ____ input.', back: 'sorted', ...proof }],
  questions: type === 'flashcards' ? [] : [{ prompt: 'Complete: ____ requires sorted input.', options: ['Binary search', 'Linear search'], correctIndex: 0, explanation: quote, ...proof }, { prompt: 'Complete: Binary search requires ____ input.', options: ['sorted', 'random'], correctIndex: 0, explanation: quote, ...proof }],
});
const response = (data, status = 200, message = '', code) => new Response(JSON.stringify({ success: status < 400, data, message, code }), { status });
window.fetch = async (url, options = {}) => {
  const parsed = new URL(String(url), location.origin), path = parsed.pathname, method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body) : null;
  if (path === '/api/users/me') return response(actor);
  if (path.startsWith('/api/notifications')) return response([]);
  if (path === `/api/academic/subjects/${sid}`) return response({ subject, modules, resources, periods: [], studySets: sets });
  if (path === '/api/academic/plans') return response({ items: [], subjects: [subject], nudges: [], nudgesEnabled: true });
  if (path === '/api/ai-study/status') return response({ enabled, syntheticOnly: true, message: enabled ? 'Synthetic QA only.' : 'Generation disabled.', maxBytes: 5242880, maxPages: 20, maxSlides: 30, maxCards: 10, maxQuestions: 5, remaining: 3, dailyLimit: 3 });
  if (path.startsWith('/api/ai-study/sources/')) {
    const resource = resources.find(row => row.id === path.split('/').at(-1));
    if (!resource) return response(null, 404, 'Source unavailable.');
    return response({ resourceId: resource.id, sourceId: fingerprint, subjectId: sid, moduleId: resource.moduleId, name: resource.title + '.' + resource.kind, format: resource.kind, bytes: 1024, matches: sets.filter(row => row.moduleId === resource.moduleId).slice().reverse().map(row => ({ id: row.id, version: row.version, title: row.title, archivedAt: row.archivedAt, type: row.ai.generationType, count: 5, questionCount: 5 })), requests: recoveryPreview && resource.id === rid2 ? [{ key: 'synthetic-recover-0001', resourceId: rid2, type: 'both', count: 5, state: 'complete' }] : [] });
  }
  if (path.startsWith('/api/ai-study/requests/')) { if (recoveryPreview) { recoveryReads++; latestPreview = recoveryPreview; return response({ state: 'complete', stage: 'ready', result: recoveryPreview }); } return response({ state: 'pending', stage: 'validating' }); }
  if (path === '/api/ai-study/generate-resource') {
    assert(body.syntheticConsent === true && body.mode === 'strict_source' && body.sourceId === fingerprint, 'Consent and strict-source identity retained');
    assert([rid, rid2].includes(body.resourceId) && options.headers['Idempotency-Key'], 'Authorized resource and request key retained');
    generationRequests.push({ ...body, key: options.headers['Idempotency-Key'] });
    if (deferGeneration) await new Promise(resolve => { releaseGeneration = resolve; });
    if (failGenerate) return response(null, 422, 'Insufficient source-supported items.', 'AI_STUDY_INSUFFICIENT_SOURCE');
    latestPreview = { previewId: crypto.randomUUID(), title: 'Saved module practice', ...content(body.type), ai: { generationType: body.type, generationMode: 'strict_source', sourceId: fingerprint, sourceResourceId: body.resourceId, sourceName: 'Synthetic source', sourceFormat: 'pdf', sourceUnits: 1, requestedCards: 5, requestedQuestions: 5, validationNote: 'Exact source text matched.' } };
    if (body.autoSave) { const saved = savePreview({ title: latestPreview.title, subjectId: sid, moduleId: resources.find(row => row.id === body.resourceId).moduleId, sourceResourceIds: [body.resourceId] }); return response(saved ? { savedSet: saved, previewId: latestPreview.previewId } : { ...latestPreview, saveFailed: true, saveError: { message: 'Save unavailable. Retry your retained preview.', status: 503 } }); }
    return response(latestPreview);
  }
  if (path === '/api/ai-study/sets' && method === 'POST') {
    const resource = resources.find(row => row.id === latestPreview.ai.sourceResourceId);
    assert(body.subjectId === sid && body.moduleId === resource.moduleId && body.sourceResourceIds?.[0] === resource.id, 'Subject/module/resource save associations preserved');
    const saved = savePreview(body);
    return saved ? response(saved, 201) : response(null, 503, 'Save unavailable. Retry your retained preview.');
  }
  if (path === '/api/ai-study/sets') return response(sets);
  if (path.startsWith('/api/ai-study/sets/')) {
    const row = sets.find(row => row.id === path.split('/')[4]);
    if (!row) return response(null, 404, 'Private set not found.');
    if (path.endsWith('/archive')) { assert(body.version === row.version, 'Archive optimistic version retained'); row.archivedAt = body.archived ? new Date().toISOString() : null; row.version++; persistSets(); }
    if (path.endsWith('/delete')) { assert(body.version === row.version, 'Delete version retained'); sets.splice(sets.indexOf(row), 1); persistSets(); return response(null); }
    if (path.endsWith('/practice')) { const correct = body.answers.filter((answer, i) => answer === row.questions[i].correctIndex).length; const result = { score: Math.round(correct * 100 / row.questions.length), total: row.questions.length, correct }; row.practiceHistory.push(result); persistSets(); return response({ ...result, practiceHistory: row.practiceHistory }); }
    return response(row);
  }
  throw new Error(`Unexpected synthetic request: ${method} ${path}`);
};
let bridge;
export function Bridge() { const auth = useAuth(), navigate = useNavigate(); useEffect(() => { bridge = { auth, navigate }; }, [auth, navigate]); return null; }
const pause = (ms = 60) => new Promise(resolve => setTimeout(resolve, ms));
function assert(value, message) { if (!value) throw new Error(message); }
async function until(check, message) { for (let i = 0; i < 160; i++) { if (check()) return; await pause(); } throw new Error(message); }
const panel = () => document.querySelector('.ai-study-inline');
const button = (text, root = document) => [...(root?.querySelectorAll('button') || [])].find(node => node.getClientRects().length && node.textContent.trim() === text);
function format(value) { const input = panel().querySelector('#ai-generation-type'); input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); }
function frame(node, offset = 85) { window.scrollTo({ top: window.scrollY + node.getBoundingClientRect().top - offset, behavior: 'instant' }); }
async function capture(name) { await pause(250); window.__acadovaCaptureDetails = { name, viewport: { width: innerWidth, height: innerHeight }, practiceColumns: panel()?.querySelector('.ai-practice-grid') ? getComputedStyle(panel().querySelector('.ai-practice-grid')).gridTemplateColumns : null, context: location.pathname }; assert(document.documentElement.scrollWidth <= innerWidth + 1, 'No horizontal overflow'); if (!window.__acadovaCaptureEnabled) return; window.__acadovaCapture = name; await until(() => !window.__acadovaCapture, 'Screenshot capture'); }
async function openSource(resourceId = rid, recovering = false) {
  const row = [...document.querySelectorAll('.academic-resource')].find(node => node.textContent.includes(resources.find(row => row.id === resourceId).title));
  const module = row.closest('.academic-module'); module.open = true;
  button('Generate Study Material', row).click();
  await until(() => panel()?.querySelector('#ai-generation-type') && panel().textContent.includes('Stored source:') || recovering && button('Regenerate material', panel()), 'Inline authorized source');
  assert(location.pathname === `/subjects/${sid}`, 'Generation must not navigate away');
  assert(!panel().querySelector('#ai-document'), 'Module source cannot be silently replaced with an upload');
}
localStorage.setItem('acadova_token', 'synthetic-module-ai');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge/><App/></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try {
  await until(() => bridge?.auth.isAuthenticated, 'Synthetic authenticated Student');
  bridge.navigate(`/subjects/${sid}`); await until(() => document.querySelector('.academic-resource'), 'Module resources');
  document.querySelector(`#module-${mid}`).open = true;
  if (phase === 'reconnect') {
    await openSource(rid2, true);
    await until(() => button('Regenerate material', panel()), 'Reload reconnects completed receipt and saves validated material');
    await until(() => document.querySelector(`#module-${mid2} summary small`).textContent.includes('1 study sets'), 'Recovered persistence count');
    assert(recoveryReads === 1 && generationRequests.length === 0 && saveRequests === 1, 'Reload recovery reads receipt and saves; no generation/quota call');
    assert(sets.at(-1).moduleId === mid2 && sets.at(-1).sourceResourceIds[0] === rid2 && sets.length === 3, 'Recovery retains source/module and earlier versions');
    panel().querySelector('.ai-flashcards').scrollIntoView({ block: 'center' }); await capture('reconnected-module');
    button('Delete set', panel()).click(); await until(() => document.querySelector('[role=dialog]'), 'Delete confirmation');
    button('Delete set', document.querySelector('[role=dialog]')).click();
    await until(() => sets.length === 2 && document.querySelector(`#module-${mid2} summary small`).textContent.includes('0 study sets'), 'Confirmed delete removes only recovered set');
    document.getElementById('result').textContent = 'PASS: module context, consent, formats, inline progress/failure/save retry, backend-confirmed counts, keyboard flashcards and quiz, archive/restore/delete, real refresh, no-call reuse, confirmed regeneration, source isolation, standalone tools, completed-receipt reconnect without generation, responsive layout at ' + innerWidth + 'x' + innerHeight;
    document.getElementById('result').hidden = true;
  } else if (!refreshed) {
    await openSource();
    assert(button('Generate study material', panel()).disabled, 'Explicit consent required');
    panel().querySelector('#ai-synthetic-consent').click(); await pause();
    for (const type of ['flashcards', 'quiz']) {
      format(type); await pause(); failGenerate = true; button('Generate study material', panel()).click();
      await until(() => panel().querySelector('.ai-inline-failure'), type + ' strict failure');
      assert(generationRequests.at(-1).type === type && sets.length === 0, 'Format propagated; failed generation never persists');
      button('Close', panel()).click(); await pause();
    }
    failGenerate = false; failSave = true;
    format('both'); await pause(); deferGeneration = true;
    button('Generate study material', panel()).click(); await until(() => releaseGeneration, 'Deferred generation');
    assert(panel().querySelector('.ai-inline-progress') && !document.querySelector('.ai-generation-tray'), 'Progress inline without duplicate tray');
    assert(document.querySelector(`#module-${mid} summary small`).textContent.includes('0 study sets'), 'No optimistic count');
    releaseGeneration(); deferGeneration = false;
    await until(() => panel().querySelector('.ai-practice-grid') && button('Retry saving to module', panel()), 'Validated preview retained on autosave failure');
    assert(!panel().querySelector('textarea') && !document.querySelector('[role=dialog]') && sets.length === 0, 'Study preview by default; save failure stays unsaved inline');
    assert(panel().textContent.includes('Save unavailable.'), 'Actionable persistence error');
    button('Review / edit source-grounded content', panel()).click(); await pause();
    assert(panel().querySelector('.ai-strict-preview'), 'Explicit source-grounded editor retained');
    button('Return to study preview', panel()).click(); await pause();
    failSave = false; button('Retry saving to module', panel()).click();
    await until(() => panel().querySelector('#ai-card-heading') && panel().querySelector('#ai-quiz-heading'), 'Both saved practice sections');
    await until(() => document.querySelector(`#module-${mid} summary small`).textContent.includes('1 study sets'), 'Count only after backend confirmed save');
    assert(saveRequests === 2 && generationRequests.length === 3 && lastSave.previewId, 'Save retry does not regenerate');
    await until(() => button('Regenerate material', panel()) && !button('Retry saving to module', panel()), 'Saved view finished loading');
    await pause();
    assert(panel().textContent.includes('Saved to module') && panel().textContent.includes(subject.name), 'Saved badge and actual subject context');
    frame(panel().querySelector('.ai-content-header')); await capture('saved-overview');
    const grid = panel().querySelector('.ai-practice-grid');
    const gridBox = grid.getBoundingClientRect();
    if (innerWidth >= 1366) assert(panel().querySelector('.ai-flashcards').getBoundingClientRect().width < gridBox.width * .7, 'Balanced desktop split panels');
    else assert(panel().querySelector('.ai-flashcards').getBoundingClientRect().width >= gridBox.width - 2, 'Mobile single-column study');
    const card = panel().querySelector('.ai-flashcard'); card.focus();
    window.__acadovaKey = 'Space'; await until(() => !window.__acadovaKey && card.getAttribute('aria-pressed') === 'true', 'Keyboard flip');
    card.scrollIntoView({ block: 'center' }); await capture('flashcard-back');
    window.__acadovaKey = 'ArrowRight'; await until(() => !window.__acadovaKey && panel().textContent.includes('Card 2 of 2'), 'Keyboard next card');
    assert(card.getAttribute('aria-pressed') === 'false', 'Moving resets flip');
    button('Previous card', panel()).click(); await pause(); assert(button('Previous card', panel()).disabled, 'Navigation bounded');
    button('Shuffle cards', panel()).click(); await pause(); assert(panel().querySelector('progress[aria-label="Flashcard progress"]').value === 1, 'Shuffle resets position');
    button('Expand cards', panel()).click(); await until(() => button('Exit expanded cards', panel()), 'Expand/fullscreen supported');
    button('Exit expanded cards', panel()).click(); await pause();
    const quiz = panel().querySelector('.ai-quiz');
    assert(button('Submit Answer', quiz).disabled, 'Quiz submission requires answer');
    quiz.querySelectorAll('input[type=radio]')[1].click(); await pause(); assert(!quiz.textContent.includes('Correct answer:'), 'Answer not revealed before explicit submission'); frame(quiz); await capture('quiz-selected'); button('Submit Answer', quiz).click(); await pause();
    assert(quiz.textContent.includes('Review this answer.') && quiz.textContent.includes('Correct answer: Binary search'), 'Wrong-answer feedback'); await capture('quiz-feedback');
    button('Next question', quiz).click(); await pause(); quiz.querySelector('input[type=radio]').click(); await pause(); button('Submit Answer', quiz).click(); await pause();
    assert(quiz.textContent.includes('Correct.'), 'Correct-answer feedback');
    button('Finish practice quiz', quiz).click(); await until(() => quiz.querySelector('.ai-score'), 'Private score saved');
    assert(quiz.textContent.includes('50%') && quiz.textContent.includes('1/2 correct'), 'Truthful score');
    quiz.querySelector('.ai-answer-review').open = true; assert(quiz.textContent.includes('Your answer: Linear search'), 'Answer review');
    frame(quiz); await capture('quiz-results');
    button('Retry practice quiz', quiz).click(); await pause(); assert(button('Submit Answer', quiz).disabled, 'Retry resets answers');
    panel().querySelector('.ai-flashcards').scrollIntoView({ block: 'center' }); await capture('module-saved');
    button('Archive set', panel()).click(); await until(() => button('Restore set', panel()), 'Archived state');
    await until(() => document.querySelector(`#module-${mid} summary small`).textContent.includes('0 study sets'), 'Archived excluded from active count');
    assert(document.querySelector('.ai-archived-sets'), 'Archive remains discoverable');
    button('Restore set', panel()).click(); await until(() => button('Archive set', panel()), 'Restored state');
    assert(sets.length === 1 && sets[0].version === 3, 'Archive/restore retains one record');
    button('Close panel', panel()).click(); await pause();
    button('Saved module practice', document.querySelector(`#module-${mid}`)).click(); await until(() => panel()?.querySelector('#ai-card-heading'), 'Reopened saved set');
    sessionStorage.setItem('module-ai-phase', 'refresh'); location.reload(); await new Promise(() => {});
  } else {
    button('Saved module practice', document.querySelector(`#module-${mid}`)).click();
    await until(() => panel()?.querySelector('#ai-card-heading') && panel().querySelector('#ai-quiz-heading'), 'Persisted Both after real refresh');
    assert(!enabled && sets.length === 1, 'Saved material accessible with generation disabled');
    button('Close panel', panel()).click(); await pause(); await openSource();
    await until(() => button('Open existing saved material', panel()), 'Compatible material recognized');
    assert(!button('Open existing saved material', panel()).disabled, 'Existing material needs no generation consent or enabled provider');
    button('Open existing saved material', panel()).click(); await until(() => button('Regenerate material', panel()), 'Existing material reused');
    assert(generationRequests.length === 0, 'Reuse causes no provider request');
    enabled = true; button('Regenerate material', panel()).click(); await until(() => button('Regenerate', document.querySelector('[role=dialog]')), 'Explicit regenerate confirmation');
    button('Regenerate', document.querySelector('[role=dialog]')).click(); await until(() => panel().querySelector('#ai-synthetic-consent'), 'Regenerate form');
    assert(!panel().querySelector('#ai-synthetic-consent').checked, 'Regeneration requires renewed consent');
    panel().querySelector('#ai-synthetic-consent').click(); await pause(); failGenerate = true;
    button('Generate study material', panel()).click(); await until(() => panel()?.querySelector('.ai-inline-failure'), 'Inline generation failure');
    assert(sets.length === 1 && !panel().querySelector('.ai-practice-grid') && !document.querySelector('[role=dialog]'), 'Generation failure never saved or duplicated');
    failGenerate = false; button('Try Again', panel()).click(); await until(() => sets.length === 2 && button('Regenerate material', panel()), 'Explicit retry autosaves new version');
    assert(generationRequests[0].key !== generationRequests[1].key && generationRequests[1].regenerateVersion === 3 && sets[0].version === 3, 'Retry key and parent version preserved');
    button('Close panel', panel()).click(); await pause(); await openSource(rid2); panel().querySelector('#ai-synthetic-consent').click(); await pause(); failGenerate = true;
    button('Generate study material', panel()).click(); await until(() => panel().querySelector('.ai-inline-failure'), 'Other module failure');
    assert(generationRequests.at(-1).resourceId === rid2 && document.querySelector(`#module-${mid2} summary small`).textContent.includes('0 study sets'), 'Source isolation and failure counts');
    button('Close', panel()).click(); await pause(); button('Close panel', panel()).click();
    bridge.navigate(`/learning/ai-study?subjectId=${sid}&moduleId=${mid}&resourceId=${rid}`);
    await until(() => document.querySelector('#ai-document') && document.body.textContent.includes('Stored source:'), 'Standalone retained');
    document.querySelector('#ai-synthetic-consent').click(); await pause(); button('Generate study material').click(); await until(() => document.querySelector('[role=dialog]'), 'Standalone error dialog retained');
    button('Close').click(); await pause(); await capture('standalone-preserved');
    // Simulate a server-validated receipt surviving a page close before its save response.
    sessionStorage.setItem('module-ai-recovery', JSON.stringify({ previewId: crypto.randomUUID(), title: 'Recovered module practice', ...content('both'), ai: { generationType: 'both', generationMode: 'strict_source', sourceId: fingerprint, sourceResourceId: rid2, sourceName: 'Synthetic second source', sourceFormat: 'pptx', sourceUnits: 1 } }));
    sessionStorage.setItem('module-ai-phase', 'reconnect'); location.reload(); await new Promise(() => {});
  }
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.message; }
