// Register visual/keyboard/validation checks in the real router and providers.
// All authentication responses are isolated fixtures; no account is created.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import '../src/index.css';

const baseline = new URLSearchParams(location.search).get('capture') === 'before';
localStorage.removeItem('acadova_token'); localStorage.removeItem('acadova_user');
document.getElementById('result').hidden = true;
let registerCalls = 0;
let releaseRegistration;
let requestBody;
let responseStatus = 201;
let responseCode;
window.fetch = async (url, options = {}) => {
  const route = new URL(String(url), location.origin).pathname;
  if (route !== '/api/auth/register') throw new Error('Unexpected auth fixture API: ' + route);
  registerCalls++; requestBody = JSON.parse(options.body);
  return new Promise((resolve) => { releaseRegistration = () => {
    releaseRegistration = null;
    resolve(new Response(JSON.stringify({ success: responseStatus < 400, data: {}, code: responseCode,
      message: responseStatus === 409 ? 'An account with this email already exists.' : 'Fixture server unavailable' }), { status: responseStatus }));
  }; });
};
const errors = [];
window.addEventListener('error', (event) => errors.push(event.message));
window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason)));
const root = createRoot(document.getElementById('root'));
let renderKey = 0;
const pause = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (value, label) => { if (!value) throw new Error(label); };
const until = async (check, label) => { for (let i = 0; i < 160; i++) { if (check()) return; await pause(); } throw new Error(label); };
// oxlint-disable-next-line react/only-export-components
function Probe() { const navigate = useNavigate(); useEffect(() => { window.__registerNavigate = navigate; }, [navigate]); return <span hidden id="register-probe" />; }
async function render(path) {
  const previous = document.getElementById('register-probe');
  window.history.replaceState({}, '', path);
  root.render(<BrowserRouter key={++renderKey}><AuthProvider><ToastProvider><ConfirmProvider><App /><Probe /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
  await until(() => document.getElementById('register-probe') !== previous && document.querySelector(path === '/login' ? '#login-email' : '#register-name'), 'Auth route ' + path);
  window.scrollTo({ top: 0, behavior: 'instant' }); await pause(200);
}
const rect = (selector) => {
  const element = document.querySelector(selector);
  if (!element || !element.getClientRects().length) return null;
  const box = element.getBoundingClientRect();
  return { top: Math.round(box.top + scrollY), bottom: Math.round(box.bottom + scrollY), width: Math.round(box.width), height: Math.round(box.height) };
};
const measure = () => ({ viewport: `${innerWidth}x${innerHeight}`, documentHeight: document.documentElement.scrollHeight,
  extraScroll: Math.max(0, document.documentElement.scrollHeight - innerHeight), card: rect('.auth-form-inner'),
  brand: rect('.auth-brand-content'), heading: rect('.auth-form-inner h1, .auth-form-inner h2'), submit: rect('.auth-submit'), loginSwitch: rect('.auth-switch') });
const capture = async (name) => {
  if (window.__acadovaCaptureEnabled) { window.__acadovaCapture = `${baseline ? 'before' : 'after'}-${name}-${innerHeight}`; await until(() => !window.__acadovaCapture, 'Capture ' + name); }
};
const key = async (value) => { window.__acadovaKey = value; await until(() => !window.__acadovaKey, 'Key ' + value); await pause(); };
const fill = (id, value) => {
  const input = document.getElementById(id);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const submit = async () => { document.querySelector('#register-name').closest('form').requestSubmit(); await pause(120); };
const layout = () => {
  assert(document.documentElement.scrollWidth <= innerWidth, 'Document horizontal overflow');
  const inputs = [...document.querySelectorAll('.auth-form-inner input')];
  for (const input of inputs) {
    const box = input.getBoundingClientRect();
    assert(box.height >= 44 && box.left >= 0 && box.right <= innerWidth + 1, 'Readable input target inside viewport: ' + input.id);
    const described = (input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
    assert(described.every((id) => document.getElementById(id)), 'Existing accessible field descriptions: ' + input.id);
  }
  for (const button of document.querySelectorAll('.auth-form-inner button, .auth-switch a')) {
    if (!button.getClientRects().length) continue;
    const box = button.getBoundingClientRect();
    assert(box.height >= 44 && box.width >= 44, 'Comfortable auth control target');
    assert(box.left >= -1 && box.right <= innerWidth + 1, 'Auth control overflow');
  }
  for (const label of document.querySelectorAll('.auth-form-inner .form-label')) assert(label.control, 'Associated visible label');
};

try {
  await render('/login'); const loginMetrics = measure(); await capture('login');
  await render('/register'); const registerMetrics = measure(); await capture('register');
  if (baseline) {
    assert(registerCalls === 0, 'Baseline makes no authentication writes');
    document.getElementById('result').textContent = 'PASS: baseline ' + JSON.stringify({ login: loginMetrics, register: registerMetrics });
  } else {
    layout();
    assert(document.querySelectorAll('h1').length === 1 && document.querySelector('h1').classList.contains('register-title'), 'Visible Register page heading at every breakpoint');
    const group = document.querySelector('.register-fields');
    assert(group && document.querySelectorAll('.auth-password-requirements li').length === 5, 'All fields and five password requirements preserved');
    const nameBox = rect('#register-name'); const emailBox = rect('#register-email');
    assert(innerWidth < 600 ? emailBox.top > nameBox.bottom : emailBox.top === nameBox.top, 'Responsive identity field grouping');
    if (innerWidth <= 1050) assert(!rect('.auth-brand-content') && rect('#register-name').top < innerHeight, 'Form prioritized over decoration');
    if (innerWidth >= 600 && innerWidth <= 1050) assert(registerMetrics.card.width === Math.min(560, innerWidth - 48), 'Tablet form uses the available full-width column');
    if (innerWidth >= 1366 && innerHeight >= 768) assert(registerMetrics.card.bottom <= innerHeight, 'Ordinary desktop form fits comfortably');

    document.getElementById('register-name').focus();
    await key('Tab'); assert(document.activeElement.id === 'register-email', 'Name to email focus order');
    await key('Tab'); assert(document.activeElement.id === 'register-password', 'Email to password focus order');
    await key('Tab'); assert(document.activeElement.getAttribute('aria-label') === 'Show password', 'Password visibility focus order');
    await key('Enter'); assert(document.getElementById('register-password').type === 'text' && document.activeElement.getAttribute('aria-pressed') === 'true', 'Password visibility keyboard activation');
    await key('Tab'); assert(document.activeElement.id === 'register-confirm-password', 'Confirmation focus order');
    await key('Tab'); await key('Space'); assert(document.getElementById('register-confirm-password').type === 'text', 'Confirmation visibility keyboard activation');

    await submit(); assert(registerCalls === 0 && document.activeElement.id === 'register-name', 'Empty submission focuses name without API');
    for (const id of ['name','email','password']) assert(document.getElementById(`register-${id}`).getAttribute('aria-invalid') === 'true', 'Inline invalid state ' + id);
    layout(); await capture('errors');
    fill('register-name', 'QA Learner'); fill('register-email', 'not-an-email'); fill('register-password', 'weak'); fill('register-confirm-password', 'different'); await pause();
    await submit(); assert(registerCalls === 0 && document.activeElement.id === 'register-email', 'Malformed email focus and no API');
    assert(document.getElementById('register-email-error').textContent === 'Enter a valid email address.', 'Specific malformed email');
    fill('register-email', ' LEARNER@EXAMPLE.TEST '); await pause(); await submit();
    assert(document.activeElement.id === 'register-password' && document.getElementById('register-password-error'), 'Weak password preserved');
    fill('register-password', 'ValidSecret1!'); await pause(); await submit();
    assert(document.activeElement.id === 'register-confirm-password' && document.getElementById('register-confirm-password-error').textContent.includes('do not match'), 'Password mismatch focus');
    assert(document.querySelectorAll('.auth-password-requirements .is-met').length === 5, 'Requirements update without hiding guidance');
    fill('register-confirm-password', 'ValidSecret1!'); await pause(); await submit();
    assert(document.activeElement.id === 'register-policy-review' && registerCalls === 0 && document.getElementById('register-policy-error'), 'Consent gating preserved');

    await key('Enter'); await until(() => document.querySelector('.policy-review-dialog'), 'Policy dialog opens');
    const dialog = document.querySelector('.policy-review-dialog');
    const dialogBox = dialog.getBoundingClientRect();
    assert(dialogBox.top >= 0 && dialogBox.bottom <= innerHeight + 1 && dialogBox.right <= innerWidth + 1, 'Policy dialog stays within viewport');
    const close = document.querySelector('[aria-label="Close policy review"]');
    const checkbox = dialog.querySelector('input[type="checkbox"]');
    const agree = [...dialog.querySelectorAll('button')].find((button) => button.textContent.includes('Agree & Continue'));
    assert(document.activeElement === close && checkbox.disabled && agree.disabled, 'Dialog focus and scroll gate');
    await key('Shift+Tab'); assert(document.activeElement.textContent === 'Close', 'Dialog reverse focus wraps');
    await key('Tab'); assert(document.activeElement === close, 'Dialog forward focus wraps');
    if (innerHeight <= 480) assert(getComputedStyle(dialog).overflowY === 'auto', 'Short Register dialog can scroll wrapped content');
    await capture('policy');
    await key('Escape'); await until(() => !document.querySelector('.policy-review-dialog'), 'Escape closes dialog');
    assert(document.activeElement.id === 'register-policy-review', 'Dialog restores triggering focus');
    await key('Enter'); await until(() => document.querySelector('.policy-review-scroll'), 'Policy reopens');
    const region = document.querySelector('.policy-review-scroll'); region.focus();
    // Browser-native End scroll; agreement still requires an explicit checkbox and button.
    await key('End'); await until(() => !document.querySelector('.policy-review-actions input').disabled, 'Keyboard reaches policy end');
    await key('Tab'); assert(document.activeElement.type === 'checkbox', 'Scroll region to consent keyboard order');
    await key('Space'); await key('Tab'); await key('Tab');
    assert(document.activeElement.textContent === 'Agree & Continue', 'Agree button focus');
    const agreeBox = document.activeElement.getBoundingClientRect();
    assert(agreeBox.top >= 0 && agreeBox.bottom <= innerHeight + 1, 'Focused agreement control is fully visible');
    await capture('policy-agree');
    await key('Enter'); await until(() => !document.querySelector('.policy-review-dialog'), 'Explicit agreement closes dialog');
    assert(!document.getElementById('register-policy-error') && document.querySelector('.policy-review-status.is-accepted'), 'Consent status and error clearing');
    await submit(); assert(registerCalls === 1 && document.querySelector('.auth-submit').disabled && document.querySelector('.auth-submit').textContent === 'Creating account...', 'Loading and disabled state');
    await submit(); assert(registerCalls === 1, 'Repeated pending submit suppressed');
    assert(requestBody.name === 'QA Learner' && requestBody.email === 'learner@example.test' && requestBody.policyAccepted === true && !Object.hasOwn(requestBody, 'confirmPassword'), 'Unchanged normalized registration contract');
    responseStatus = 503; releaseRegistration(); await until(() => !document.querySelector('.auth-submit').disabled, 'Failure enables retry');
    assert(document.getElementById('register-password').value === 'ValidSecret1!' && document.querySelector('.policy-review-status.is-accepted'), 'Draft and consent survive retry');
    responseStatus = 409; responseCode = 'REGISTRATION_PENDING_VERIFICATION'; await submit(); releaseRegistration();
    await until(() => location.pathname === '/verify-email/pending', 'Existing unverified account navigation');
    assert(!localStorage.getItem('acadova_token'), 'Registration does not authenticate');

    await render('/register');
    for (const [id, value] of [['name','QA Learner'], ['email','learner@example.test'], ['password','ValidSecret1!'], ['confirm-password','ValidSecret1!']]) fill('register-' + id, value);
    await pause(); document.getElementById('register-policy-review').click();
    await until(() => document.querySelector('.policy-review-scroll'), 'New-account policy review');
    const newPolicy = document.querySelector('.policy-review-scroll'); newPolicy.scrollTop = newPolicy.scrollHeight; newPolicy.dispatchEvent(new Event('scroll'));
    await until(() => !document.querySelector('.policy-review-actions input').disabled, 'New-account consent enabled');
    document.querySelector('.policy-review-actions input').click(); await pause();
    [...document.querySelectorAll('.policy-review-buttons button')].find((button) => button.textContent.includes('Agree')).click(); await pause();
    responseStatus = 201; responseCode = undefined; await submit(); releaseRegistration();
    await until(() => location.pathname === '/verify-email/pending', 'New registration verification navigation');
    assert(!localStorage.getItem('acadova_token') && sessionStorage.getItem('acadova_pending_email') === 'learner@example.test', 'New registration awaits verification without authenticating');

    await render('/register'); document.querySelector('.auth-switch a').click();
    await until(() => location.pathname === '/login' && document.getElementById('login-email'), 'Login navigation');
    assert(!document.querySelector('.auth-shell--register'), 'Register styling does not follow Login');
    assert(JSON.stringify(measure()) === JSON.stringify(loginMetrics), 'Login layout remains exactly unchanged within run');
    await render('/register'); layout(); await capture('register-final');
    assert(errors.length === 0, 'Runtime errors: ' + errors.join('; '));
    document.getElementById('result').textContent = 'PASS: Register grouping/layout, focus/visibility, empty/malformed/weak/mismatch, policy keyboard/consent, loading/retry/verification and unchanged Login\n' + JSON.stringify({ login: loginMetrics, register: registerMetrics });
  }
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.stack; }
