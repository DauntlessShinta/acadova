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
  return json(data, 200, { pagination: { page: 1, limit: 25, total: 0 }, summary: { recordedEarned: 0, recordedSpent: 0 } });
};
const root = createRoot(document.getElementById('root')); let renderKey = 0;
const pause = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (value, label) => { if (!value) throw new Error(label); };
const until = async (check, label) => { for (let i = 0; i < 150; i++) { if (check()) return; await pause(); } throw new Error(label); };
const visible = (selector) => [...document.querySelectorAll(selector)].filter((element) => element.getClientRects().length && (!element.closest('details:not([open])') || element.matches('summary')));
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
  for (const control of window.__acadovaVisualBaseline ? [] : visible('button, a[href], input:not([type="hidden"]), select, summary')) {
    const box = control.getBoundingClientRect();
    assert(box.width >= 23.9 && box.height >= 23.9, `Target below 24px on ${path}: ${control.id || control.className || control.textContent?.slice(0, 45)} (${box.width}x${box.height})`);
  }
  for (const control of window.__acadovaVisualBaseline ? [] : visible('.btn, .workflow-tabs button, .account-trigger, .notification-trigger')) {
    assert(control.getBoundingClientRect().height >= 43.9, 'Important control below 44px: ' + path + ' ' + control.className);
  }
}
const errors = [];
window.addEventListener('error', (event) => errors.push(event.message)); window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason)));
// The runner captures each screen at this viewport, without importing evidence into the app.
const capture = async (name) => {
  document.querySelectorAll('.app-toast button').forEach((button) => button.click());
  const section = name.startsWith('landing-') ? document.getElementById(name.slice(8)) : null;
  window.scrollTo({ top: section ? window.scrollY + section.getBoundingClientRect().top - 88 : 0, behavior: 'instant' }); await pause(240);
  if (window.__acadovaCaptureEnabled) {
    window.__acadovaCapture = name;
    await until(() => !window.__acadovaCapture, 'Screenshot handshake: ' + name);
  }
};
try {
  assert(window.visualViewport.scale === 1 && devicePixelRatio === 1, '100% visual comparison');
  for (const [name, path] of [['landing','/'],['login','/login'],['register','/register'],['pending','/verify-email/pending']]) {
    await render(path, null); await pause(150);
    assert(document.querySelector(name === 'landing' ? '.landing-network' : '.auth-brand-panel'), 'Baseline visual structure: ' + name);
    assert(document.documentElement.scrollWidth <= innerWidth, 'Overflow: ' + name);
    await capture(name);
    if (name === 'landing' && [1366,390].includes(innerWidth)) {
      for (const section of ['how-it-works','credit-system','skill-network','dashboard-preview','sdg-section']) await capture('landing-' + section);
    }
  }
  assert(errors.length === 0, 'Runtime errors: ' + errors.join('; '));
  document.getElementById('result').textContent = `PASS: ${innerWidth}x${innerHeight} ${window.__acadovaVisualBaseline ? '1ef2440 reference' : 'restored current'} Landing/Login/Register/Pending`;
  document.getElementById('result').hidden = true;
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.message; }
