// Real router, AuthProvider and DOM in two same-origin browser tabs.
// Only the backend is an in-memory fixture; no live credentials or database writes.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import '../src/index.css';

const companionMode = new URLSearchParams(location.search).has('qa-companion');
const student = { _id: 'learner', name: 'QA Learner', email: 'learner@example.test',
  role: 'student', emailVerified: true, credits: 82, skillsToLearn: ['Java'], skillsToTeach: ['Math'], onboardingFinishedAt: '2026-10-01' };
const other = { ...student, _id: 'other', name: 'Other Student', credits: 7 };
const peer = { ...student, _id: 'peer', name: 'QA Tutor' };
const assessment = { id: 'a', title: 'QA assessment', topic: 'Java', passingScore: 100,
  questionCount: 1, questions: [{ prompt: 'Choose the correct answer', options: ['Correct', 'Incorrect'] }] };
const session = { _id: 's', subject: 'QA Session', learner: student, tutor: peer, status: 'scheduled',
  scheduledAt: new Date(Date.now() + 3600000).toISOString(), creditAmount: 20, meetingMethod: 'online', meetingLink: 'https://example.test/meeting' };
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify({ success: status < 400, data, ...extra }), { status });
let backendUser = { ...student };
let loginStatus = 200;
let loginCode;
let loginCalls = 0;
let loginBody;
let meCalls = 0;
let assessmentCalls = 0;
let awarded = false;
let holdNextMe = false;
let releaseMe;
let failMe = false;
let companion;

if (!companionMode) {
  window.__qaBackendFetch = async (url, options = {}) => {
    const route = new URL(String(url), location.origin).pathname;
    if (route === '/api/auth/login') {
      loginCalls++;
      loginBody = JSON.parse(options.body);
      if (loginStatus === 'network') throw new TypeError('Fixture network failure');
      return loginStatus === 200 ? json({ token: 'fixture-learner', user: backendUser })
        : json(null, loginStatus, { code: loginCode, message: 'Private account detail' });
    }
    const account = options.headers?.Authorization === 'Bearer fixture-other' ? other : backendUser;
    if (route === '/api/users/me') {
      meCalls++;
      if (failMe) throw new TypeError('Fixture profile unavailable');
      return json(account);
    }
    if (route === '/api/assessments/a/submit') {
      assessmentCalls++;
      const passed = JSON.parse(options.body).answers[0] === 0;
      const rewardIssued = passed && !awarded;
      if (rewardIssued) { awarded = true; backendUser = { ...backendUser, credits: 102 }; }
      return json({ passed, score: passed ? 100 : 0, rewardIssued, creditsAwarded: rewardIssued ? 20 : 0 });
    }
    if (options.method && options.method !== 'GET') throw new Error('Unexpected fixture mutation: ' + route);
    if (route === '/api/sessions/s') return json(session);
    if (route === '/api/sessions') return json([session]);
    if (route === '/api/sessions/s/messages') return json([]);
    if (route === '/api/assessments') return json([assessment]);
    if (route === '/api/assessments/a') return json(assessment);
    if (route === '/api/notifications/unread-count') return json({ count: 0 });
    if (route === '/api/learning/topics') return json([]);
    if (route === '/api/credits/rules') return json({ tutoringSessionCost: 20, assessmentReward: 20, startingCreditGrant: 100 });
    if (route === '/api/credits/transactions') return json([], 200, { summary: { recordedEarned: awarded ? 20 : 0, recordedSpent: 0 }, pagination: { page: 1, total: 0 } });
    if (route.startsWith('/api/analytics/') || route === '/api/health') return json({});
    if (route.startsWith('/api/notifications')) return json([]);
    throw new Error('Unexpected fixture read: ' + route);
  };
}
window.fetch = async (url, options = {}) => {
  const route = new URL(String(url), location.origin).pathname;
  const response = await (companionMode ? window.opener.__qaBackendFetch : window.__qaBackendFetch)(url, options);
  if (!companionMode && route === '/api/users/me' && holdNextMe) {
    holdNextMe = false;
    return new Promise((resolve) => { releaseMe = () => { releaseMe = null; resolve(response); }; });
  }
  return response;
};

const root = createRoot(document.getElementById('root'));
let renderKey = 0;
const pause = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (value, label) => { if (!value) throw new Error(label); };
const until = async (check, label) => { for (let i = 0; i < 160; i++) { if (check()) return; await pause(); } throw new Error(label); };
// oxlint-disable-next-line react/only-export-components
function Probe() {
  const auth = useAuth(); const path = useLocation().pathname;
  useEffect(() => { window.__qaAuth = auth; }, [auth]);
  return <span hidden id="qa-probe" data-path={path} data-user={auth.user?._id || ''} data-credits={auth.credits} data-token={auth.token || ''} />;
}
async function render(path, token = null) {
  if (!companionMode) {
    if (token) localStorage.setItem('acadova_token', token);
    else { localStorage.removeItem('acadova_token'); localStorage.removeItem('acadova_user'); }
  }
  const previous = document.getElementById('qa-probe');
  window.history.replaceState({}, '', path);
  root.render(<BrowserRouter key={++renderKey}><AuthProvider><ToastProvider><ConfirmProvider><App /><Probe /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
  await until(() => document.getElementById('qa-probe') !== previous && document.getElementById('qa-probe')?.dataset.path === path.split('?')[0], 'Route commit: ' + path);
  await until(() => window.__qaAuth && !window.__qaAuth.loading, 'Auth load');
  await pause(150);
}
const key = async (value) => { window.__acadovaKey = value; await until(() => !window.__acadovaKey, 'Keyboard ' + value); await pause(); };
const pointer = async (element) => {
  element.scrollIntoView({ block: 'center', behavior: 'instant' }); await pause(200);
  const box = element.getBoundingClientRect();
  window.__acadovaPointer = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await until(() => !window.__acadovaPointer, 'Pointer click'); await pause();
};
const fill = (selector, value) => {
  const input = document.querySelector(selector);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const submitLogin = async () => { document.querySelector('#login-email').closest('form').requestSubmit(); await pause(150); };
const credits = () => Number(document.getElementById('qa-probe')?.dataset.credits);
const storageEvent = (key, oldValue, newValue) => window.dispatchEvent(new StorageEvent('storage', { key, oldValue, newValue, storageArea: localStorage }));
const visibleBalance = (amount) => document.querySelector('.utility-credits, .credit-pill')?.textContent.includes(`${amount} Credits`);

if (companionMode) {
  await render('/assessments?open=a');
  window.__qaPassAssessment = async () => {
    await until(() => document.querySelector('input[name="question-0"]'), 'Assessment loaded');
    document.querySelector('input[name="question-0"]').click(); await pause();
    document.querySelector('input[name="question-0"]').closest('form').requestSubmit();
    await until(() => credits() === 102, 'Assessment authoritative balance');
    assert(document.body.textContent.includes('+20 credits earned'), 'Assessment result reward');
  };
  window.__qaStorageWrite = (key, value) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value);
  document.getElementById('result').textContent = 'Companion ready';
} else {
  const checks = [];
  try {
    await render('/');
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const panels = [...document.querySelectorAll('[role="tabpanel"]')];
    assert(tabs.length === 3 && panels.length === 3, 'Three tab/panel pairs');
    const selection = (index) => {
      assert(document.activeElement === tabs[index], 'Tab focus ' + index);
      tabs.forEach((tab, i) => {
        assert(tab.tabIndex === (i === index ? 0 : -1), 'Roving tabindex');
        assert(tab.getAttribute('aria-selected') === String(i === index), 'Selected state');
        const panel = document.getElementById(tab.getAttribute('aria-controls'));
        assert(panel && panel.getAttribute('aria-labelledby') === tab.id, 'Reciprocal ARIA IDs');
        assert(panel.hidden === (i !== index), 'Only selected panel visible');
      });
      assert(new Set([...tabs, ...panels].map((element) => element.id)).size === 6, 'Unique IDs');
    };
    await pointer(tabs[1]); selection(1);
    await key('ArrowRight'); selection(2);
    assert(getComputedStyle(tabs[2]).outlineStyle === 'solid' && getComputedStyle(tabs[2]).outlineWidth === '3px', 'Visible keyboard focus ring');
    await key('ArrowRight'); selection(0);
    await key('ArrowLeft'); selection(2);
    await key('Home'); selection(0);
    await key('End'); selection(2);
    if (document.querySelector('[role="tablist"]').getAttribute('aria-orientation') === 'vertical') {
      await key('ArrowDown'); selection(0); await key('ArrowUp'); selection(2);
    }
    await key('Enter'); selection(2); await key('Space'); selection(2);
    await key('Tab'); assert(document.activeElement === panels[2], 'Tab reaches active panel');
    await key('Shift+Tab'); selection(2);
    assert(panels[2].textContent.includes('Understand every credit movement'), 'Preview content preserved');
    checks.push('B-01 pointer, arrows/wrap, Home/End, Enter/Space, roving focus, panel associations and content');

    await render('/login');
    await submitLogin();
    assert(document.activeElement.id === 'login-email' && document.getElementById('login-password-error'), 'Empty fields and focus');
    fill('#login-email', 'not-an-email'); fill('#login-password', 'fictional'); await pause();
    await submitLogin();
    assert(loginCalls === 0 && document.getElementById('login-email-error')?.textContent === 'Enter a valid email address.', 'Malformed email blocked before API');
    const emailInput = document.getElementById('login-email');
    assert(emailInput.getAttribute('aria-invalid') === 'true' && emailInput.getAttribute('aria-describedby') === 'login-email-error' && document.activeElement === emailInput, 'Field error association and focus');
    fill('#login-email', 'still-invalid'); await pause();
    assert(document.getElementById('login-email-error'), 'Error retained while malformed');
    fill('#login-email', ' LEARNER@EXAMPLE.TEST '); await pause();
    assert(!document.getElementById('login-email-error') && emailInput.getAttribute('aria-invalid') === 'false' && !emailInput.hasAttribute('aria-describedby'), 'Error clears when corrected');
    loginStatus = 401; await submitLogin();
    assert(loginBody.email === 'learner@example.test' && document.body.textContent.includes('Email or password is incorrect.'), 'Valid format reaches API and private credential handling');
    for (const [status, message] of [[429, 'Too many login attempts.'], [503, 'Acadova is temporarily unavailable.'], ['network', 'Unable to reach Acadova.'], [403, 'Unable to sign in.']]) {
      loginStatus = status; await submitLogin(); assert(document.body.textContent.includes(message), 'Login error ' + status);
      assert(!document.body.textContent.includes('Private account detail'), 'Private error detail hidden');
    }
    loginStatus = 403; loginCode = 'EMAIL_VERIFICATION_REQUIRED'; await submitLogin();
    await until(() => location.pathname === '/verify-email/pending', 'Verification restriction navigation');
    assert(sessionStorage.getItem('acadova_pending_email') === 'learner@example.test', 'Pending verification normalized email');
    loginCode = undefined; loginStatus = 200;
    await render('/login'); fill('#login-email', student.email); fill('#login-password', 'fictional'); await pause(); await submitLogin();
    await until(() => location.pathname === '/dashboard' && window.__qaAuth.isAuthenticated, 'Valid login');
    assert(credits() === 82, 'Login full profile');
    checks.push('B-02 malformed/no API, empty fields, correction, normalization, success, credentials, cooldown, network/server, suspension privacy and verification');

    await render('/sessions/s', 'fixture-learner');
    await until(() => document.querySelector('.session-room-page') || document.body.textContent.includes('QA Session'), 'Session Room');
    const roomShowsBalance = innerWidth > 1024;
    assert(credits() === 82 && (!roomShowsBalance || visibleBalance(82)), 'Original Session Room balance 82');
    const roomNode = document.querySelector('main');
    holdNextMe = true;
    const staleRequest = window.__qaAuth.refreshUser();
    await until(() => releaseMe, 'Old profile response held');
    companion = window.open('/__demo-test?qa-companion=1', 'acadova-qa-companion');
    assert(companion, 'Second same-origin tab opened');
    await until(() => companion.__qaPassAssessment, 'Companion ready');
    await companion.__qaPassAssessment();
    await until(() => credits() === 102 && (!roomShowsBalance || visibleBalance(102)), 'Already-open room receives native storage invalidation');
    assert(location.pathname === '/sessions/s' && document.querySelector('main') === roomNode, 'Room balance updated without navigation');
    releaseMe(); await staleRequest; await pause(200);
    assert(credits() === 102, 'Older 82 response cannot overwrite 102');
    assert(assessmentCalls === 1 && awarded, 'Assessment submitted exactly once');
    const settledCount = meCalls; await pause(400); assert(meCalls === settledCount, 'Cross-tab refresh does not loop');

    const beforeBurst = meCalls;
    window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus'));
    await pause(300); assert(meCalls === beforeBurst + 1, 'Focus/visibility burst makes one read');
    const beforeForeign = meCalls;
    storageEvent('acadova_user', JSON.stringify(student), JSON.stringify({ ...other, credits: 9999 }));
    storageEvent('acadova_user', '{}', '{broken'); await pause(250);
    assert(credits() === 102 && meCalls === beforeForeign, 'Foreign or malformed storage cannot change balance');
    storageEvent('acadova_user', JSON.stringify(student), JSON.stringify({ ...student, credits: 9999 }));
    await pause(300);
    assert(credits() === 102 && meCalls === beforeForeign + 1, 'Same-account storage balance is never trusted');
    const beforeHidden = meCalls;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange'));
    storageEvent('acadova_user', JSON.stringify(student), JSON.stringify({ ...student, credits: 9999 }));
    await pause(250); assert(meCalls === beforeHidden, 'Hidden tab defers background reads');
    delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange')); await pause(300);
    assert(meCalls === beforeHidden + 1 && credits() === 102, 'Visible tab revalidates deferred invalidation');
    failMe = true; await window.__qaAuth.refreshUser(); assert(credits() === 102, 'Network failure retains account balance'); failMe = false;

    holdNextMe = true;
    const oldAccountRequest = window.__qaAuth.refreshUser(); await until(() => releaseMe, 'Old account request held');
    companion.__qaStorageWrite('acadova_token', 'fixture-other');
    await until(() => window.__qaAuth.user?._id === other._id && credits() === 7, 'Account switch authoritative profile');
    releaseMe(); await oldAccountRequest; await pause();
    assert(window.__qaAuth.token === 'fixture-other' && window.__qaAuth.user._id === other._id && credits() === 7, 'Old account response rejected');

    holdNextMe = true;
    const logoutRequest = window.__qaAuth.refreshUser(); await until(() => releaseMe, 'Logout request held');
    companion.__qaStorageWrite('acadova_token', null);
    await until(() => !window.__qaAuth.isAuthenticated && !window.__qaAuth.user && !window.__qaAuth.token, 'Cross-tab logout');
    releaseMe(); await logoutRequest; await pause();
    assert(!window.__qaAuth.user && credits() === 0, 'Delayed response cannot restore logout');
    companion.close(); companion = null;
    await render('/sessions/s', 'fixture-learner');
    holdNextMe = true;
    const unmountedRequest = window.__qaAuth.refreshUser(); await until(() => releaseMe, 'Unmount request held');
    await render('/login');
    releaseMe(); await unmountedRequest; await pause();
    assert(!window.__qaAuth.user && !localStorage.getItem('acadova_user'), 'Unmounted provider cannot restore stale user storage');
    checks.push(`B-03 two native browser tabs: supported assessment submit 82→102 in existing Session Room ${roomShowsBalance ? 'display' : 'AuthContext (compact room has no balance pill)'}, stale responses, no refresh loops, burst coalescing, untrusted state, hidden/visible, offline, switch, logout and unmount`);
    document.getElementById('result').textContent = 'PASS: ' + checks.join('\n');
  } catch (error) {
    document.getElementById('result').textContent = 'FAIL: ' + error.stack;
  } finally {
    companion?.close();
  }
}
