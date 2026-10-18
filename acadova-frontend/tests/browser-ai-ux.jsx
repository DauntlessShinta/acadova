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
import academicService from '../src/services/academicService';
import '../src/index.css';
const sid = '507f1f77bcf86cd799439021'; const mid = '507f1f77bcf86cd799439022'; const rid = '507f1f77bcf86cd799439023'; const tid = '507f1f77bcf86cd799439024';
const actor = { _id: '507f1f77bcf86cd799439011', name: 'Synthetic Bundle B Student', email: 'synthetic@example.test', role: 'student', emailVerified: true, credits: 100, skillsToTeach: [], skillsToLearn: [], onboardingFinishedAt: '2026-10-01' };
const subject = { id: sid, name: 'Algorithms · Private study workspace', courseCode: 'ITE 314', termId: tid, moduleCount: 1, completedCount: 0 };
const module = { id: mid, _id: mid, subjectId: sid, title: 'Module 12 · Search techniques', status: 'not_started', order: 12, periodId: null };
const resources = [{ id: rid, subjectId: sid, moduleId: mid, title: 'Synthetic algorithm slides', fileName: 'synthetic-algorithms.pptx', kind: 'pptx', visibility: 'private' }];
const hash = 'a'.repeat(64); const quote = 'Binary search requires sorted input to repeatedly halve the search space.';
const prompt = 'Complete the source quotation: ____ requires sorted input to repeatedly halve the search space.';
const proof = { sourceId: hash, sourceRef: 1, sourceQuote: quote };
const plans = []; const sets = []; let serial = 100; let enabled = true; let dismissed = false; let insufficient = false; let lastSave; let generated = 0; let releaseGeneration; let deferred = false;
const response = (data, status = 200, message = '', code) => new Response(JSON.stringify({ success: status < 400, data, message, code }), { status });
let fileDownloadFails = false;
window.fetch = async (url, options = {}) => {
  const parsed = new URL(String(url), location.origin); const path = parsed.pathname; const method = options.method || 'GET'; const body = options.body ? JSON.parse(options.body) : null;
  if (path === '/api/users/me') return response(actor);
  if (path.startsWith('/api/notifications')) return response([]);
  if (path === `/api/academic/resources/${rid}/file`) {
    if (options.headers.Authorization !== 'Bearer synthetic-ai-ux') throw new Error('Private file must retain authenticated fetch');
    return fileDownloadFails ? response(null,404,'Unavailable') : new Response('Synthetic PDF boundary', {headers:{'Content-Type':'application/pdf'}});
  }
  if (path === '/api/academic/state') return response({ terms: [{ id: tid, startYear: 2026, endYear: 2027, semester: 'First Semester', displayName: 'SY 2026–2027 • First Semester' }], currentTermId: tid, subjects: [subject], incompleteCount: 1, needsReview: [] });
  if (path === `/api/academic/subjects/${sid}`) return response({ subject, periods: [], modules: [module], resources, studySets: sets });
  if (path === '/api/academic/plans/preferences') { enabled = body.enabled; return response({ enabled }); }
  if (path === '/api/academic/plans/nudges/dismiss') { dismissed = true; return response(null); }
  if (path === '/api/academic/plans' && method === 'GET') return response({ items: plans, subjects: [subject], nudgesEnabled: enabled, nudges: enabled && !dismissed ? [{ key: `module:${mid}`, title: 'No recorded module review: Module 12', subjectId: sid, moduleId: mid, kind: 'unreviewed' }] : [] });
  if (path === '/api/academic/plans' && method === 'POST') { const row = { ...body, id: String(++serial).padStart(24, '0'), version: 1, completed: false }; plans.push(row); return response(row, 201); }
  if (path.startsWith('/api/academic/plans/') && method === 'PATCH') { const row = plans.find(row => row.id === path.split('/').at(-1)); Object.assign(row, body, { version: row.version + 1 }); return response(row); }
  if (path === '/api/ai-study/status') return response({ enabled: true, message: 'Synthetic local QA only.', maxBytes: 5242880, maxPages: 20, maxSlides: 30, maxCards: 10, maxQuestions: 5, dailyLimit: 3, remaining: 3 - generated });
  if (path === `/api/ai-study/sources/${rid}`) return response({ resourceId: rid, sourceId: hash, subjectId: sid, moduleId: mid, name: 'synthetic-algorithms.pptx', format: 'pptx', bytes: 2048 });
  if (path === '/api/ai-study/generate-resource') {
    generated++; if (deferred) await new Promise(resolve => { releaseGeneration = resolve; }); if (body.syntheticConsent !== true || body.mode !== 'strict_source' || body.sourceId !== hash || body.resourceId !== rid || !options.headers['Idempotency-Key']) throw new Error('Stored-source consent/identity boundary');
    if (insufficient) return response(null, 422, 'Insufficient source-supported items.', 'AI_STUDY_INSUFFICIENT_SOURCE');
    return response({ previewId: '11111111-1111-4111-8111-111111111111', title: 'Source-exact search practice', flashcards: body.type === 'quiz' ? [] : [{ front: prompt, back: 'Binary search', ...proof }], questions: body.type === 'flashcards' ? [] : [{ prompt, options: ['Binary search', 'Linear search', 'Hash lookup', 'Tree traversal'], correctIndex: 0, explanation: quote, ...proof, optionEvidence: [proof, { ...proof, sourceRef: 2, sourceQuote: 'Linear search checks every entry in the input sequence in order.' }, { ...proof, sourceRef: 3, sourceQuote: 'Hash lookup uses a key to locate the associated stored value.' }, { ...proof, sourceRef: 4, sourceQuote: 'Tree traversal visits connected nodes in a defined exploration order.' }] }], ai: { generationMode: 'strict_source', validationVersion: 'exact_cloze_v1', sourceId: hash, sourceResourceId: rid, sourceName: 'synthetic-algorithms.pptx', sourceUnits: 4, sourceFormat: 'pptx', coverage: '1/1 source-supported question', validationNote: 'Exact extracted-text matches. Not a mastery assessment.' } });
  }
  if (path === '/api/ai-study/sets' && method === 'POST') {
    if (body.content && body.content.questions?.[0]?.options[0] !== 'Binary search') return response(null, 400, 'Your edits no longer match the strict-source evidence. Restore exact source wording.');
    lastSave = body; const row = { id: String(++serial).padStart(24, '0'), title: body.title, subjectId: sid, moduleId: mid, sourceResourceIds: [rid], ...body.content, origin: 'ai', state: 'private', version: 1, ai: { generationMode: 'strict_source', validationVersion: 'exact_cloze_v1', sourceId: hash, sourceName: 'synthetic-algorithms.pptx', sourceFormat: 'pptx', sourceUnits: 4 }, practiceHistory: [] }; sets.push(row); return response(row, 201);
  }
  if (path.startsWith('/api/ai-study/sets/')) return response(sets.find(row => row.id === path.split('/').at(-1)));
  if (path.startsWith('/api/ai-study/requests/')) return response({state:'pending',stage:'generating'});
  throw new Error(`Unexpected AI UX fixture request: ${method} ${path}`);
};
let bridge;
export function Bridge() { const auth = useAuth(); const navigate = useNavigate(); const location = useLocation(); useEffect(() => { bridge = { auth, navigate, location }; }, [auth, navigate, location]); return null; }
const pause = (ms=100) => new Promise(resolve=>setTimeout(resolve,ms));
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const until=async(condition,message)=>{for(let n=0;n<150;n++){if(condition())return;await pause();}throw new Error(message);};
const button=text=>[...document.querySelectorAll('button')].find(node=>node.getClientRects().length&&node.textContent.trim()===text);
const fill=(selector,value)=>{const input=document.querySelector(selector);assert(input,'Missing '+selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));};
const go=async path=>{bridge.navigate(path);await pause(300);};
const capture=async name=>{assert(document.documentElement.scrollWidth<=innerWidth+1,'No horizontal overflow');if(!window.__acadovaCaptureEnabled)return;await pause(300);window.__acadovaCapture=name;await until(()=>!window.__acadovaCapture,'Capture '+name);};
localStorage.setItem('acadova_token','synthetic-ai-ux');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge/><App/></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
const before=new URLSearchParams(location.search).get('capture')==='/before';
try {
  await until(()=>bridge?.auth.isAuthenticated,'Synthetic auth');
  await go(`/subjects/${sid}`);await until(()=>document.querySelector('.academic-resource'),'Source workspace');await capture('workspace');
  if(before)assert([...document.querySelectorAll('a')].some(a=>a.textContent==='Generate Practice Quiz'),'Saved original workspace loaded');
  if(!before){
    const menu=document.querySelector('.ac-generate-menu');assert(menu,'Single primary generation control');menu.open=true;
    assert([...menu.querySelectorAll('a')].map(a=>a.textContent).join(',')==='Flashcards,Quiz,Both','Three preserved source formats');
    const add=document.querySelector('.ac-add-material');add.open=true;assert(add.querySelectorAll('button').length===5,'All material options preserved');add.open=false;
    menu.open=false;
  }
  const sourcePath=`/learning/ai-study?subjectId=${sid}&moduleId=${mid}&resourceId=${rid}&format=both`;
  await go(sourcePath);await until(()=>document.querySelector('#ai-synthetic-consent')&&document.body.textContent.includes('Stored source:'),'Owned source selection');await capture('create');
  assert(button('Generate study material').disabled,'Explicit consent required');fill('#ai-item-count','1');document.querySelector('#ai-synthetic-consent').click();await pause();
  deferred=true;insufficient=true;button('Generate study material').click();await until(()=>releaseGeneration,'One active request');
  await go(`/subjects/${sid}`);await until(()=>document.querySelector('.ai-generation-tray'),'Background status preserved');await capture('background-processing');
  releaseGeneration();deferred=false;await until(()=>document.querySelector('.ai-generation-tray')?.textContent.includes('Generation failed'),'Background failure');
  assert(!document.querySelector('[role=dialog]'),'Background failure never interrupts another workflow');await capture('background-failure');
  if(!before){assert(document.querySelector('.ai-generation-tray').getBoundingClientRect().height<=104,'Compact default status');document.querySelector('.ai-generation-tray a').click();}
  else await go(sourcePath);
  if(!before){await until(()=>document.querySelector('[role=dialog]'),'Immediate focused failure dialog');assert(!document.querySelector('.ai-generation-tray'),'No duplicate floating error on active page');assert(!document.querySelector('.ai-study-page .alert-danger'),'No duplicate page banner');}
  else await until(()=>document.querySelector('#ai-synthetic-consent'),'Original generation page');
  await capture('failure-dialog');
  if(!before){
    const dialog=document.querySelector('[role=dialog]');assert(dialog.contains(document.activeElement),'Failure receives focus');assert(dialog.textContent.includes('request fewer items'),'Server error code selects source-specific recovery');const countBefore=generated;button('Close').click();await pause();assert(generated===countBefore&&!document.querySelector('[role=dialog]'),'Closing never retries');button('View last failure details').click();await until(()=>document.querySelector('[role=dialog]'),'Explicit reopen');button('Close').click();
    // New active-page failure opens exactly once without scrolling to the top.
    await until(()=>document.querySelector('#ai-synthetic-consent'),'Retry source form');document.querySelector('#ai-synthetic-consent').click();await pause();button('Generate study material').click();await until(()=>document.querySelector('[role=dialog]'),'Active-page failure');assert(generated===countBefore+1,'One request per explicit generation');button('Close').click();
    insufficient=false;await until(()=>button('View last failure details'),'Acknowledged active-page failure');button('View last failure details').click();await until(()=>button('Try Again'),'Reopened retry action');button('Try Again').click();await until(()=>document.querySelector('#strict-q-0-option-0'),'Preview after explicit retry');
    fill('#strict-q-0-option-0','Temporary review edit');await pause();fill('#strict-q-0-option-0','Binary search');await pause();await capture('review');button('Save to My Study Sets').click();await until(()=>button('Rename set'),'Explicit source-linked save');assert(lastSave.subjectId===sid&&lastSave.moduleId===mid&&lastSave.content.questions[0].sourceId===hash,'Identity and subject/module associations preserved');
    await go('/learning/ai-study');await until(()=>document.querySelector('#ai-document'),'Upload form');const fileInput=document.querySelector('#ai-document');const transfer=new DataTransfer();transfer.items.add(new File(['bad'],'unsupported.txt',{type:'text/plain'}));fileInput.files=transfer.files;fileInput.dispatchEvent(new Event('change',{bubbles:true}));await until(()=>document.querySelector('#ai-file-error'),'Unsupported file inline');assert(!document.querySelector('[role=dialog]'),'Input errors are not modals');
    // Bound the new PDF opener without allocating another renderer or writing a download.
    const originalOpen=window.open;let opened;let replaced='';let closed=false;
    window.open=(url,target)=>{assert(url==='about:blank'&&target==='_blank','Open a fresh blank viewer');opened={opener:window,closed:false,location:{replace:url=>{replaced=url;}},close:()=>{closed=true;}};return opened;};
    try {
      await academicService.download({id:rid,kind:'pdf'},{open:true});assert(opened.opener===null&&replaced.startsWith('blob:'),'Private PDF uses authenticated blob with isolated opener');
      fileDownloadFails=true;let denied=false;try{await academicService.download({id:rid,kind:'pdf'},{open:true});}catch{denied=true;}assert(denied&&closed,'Failed private PDF closes its blank viewer');
    } finally {window.open=originalOpen;fileDownloadFails=false;}
  }
  document.getElementById('result').textContent='PASS: '+(before?'saved pre-change visual evidence':'source actions, consent, compact background progress/failure, one focused error event, explicit close/reopen/retry, preview editing, source-linked save and inline file validation')+' at '+innerWidth+'x'+innerHeight;
  document.getElementById('result').hidden=true;
}catch(error){document.getElementById('result').textContent='FAIL: '+error.message;}
