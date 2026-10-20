// Real app/router; synthetic API boundary only. DB correctness is tested separately.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import '../src/index.css';
let bridge, role = 'admin', mode = 'wrong', pending;
const writes = [];
const actor = () => ({ _id: '1'.repeat(24), name: 'Synthetic Staff', role, email: 'synthetic@example.test', emailVerified: true, credits: 100, onboardingFinishedAt: '2026-10-01', experience: { expActive: false, freeLearning: false } });
window.fetch = async (url, options = {}) => {
  const path = new URL(url, location.origin).pathname;
  const body = options.body ? JSON.parse(options.body) : {};
  const reply = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));
  const ok = data => reply({ success: true, data });
  if (path === '/api/auth/login') {
    writes.push('password');
    if (role === 'student') return ok({ token: 'synthetic-student-session', user: actor() });
    pending = { mfaRequired: true, challenge: 'a'.repeat(64), maskedEmail: 's***@example.test', expiresAt: new Date(Date.now() + 300000).toISOString(), resendAt: new Date(Date.now() + 60000).toISOString() };
    return ok(pending);
  }
  if (path === '/api/auth/staff-mfa/verify') {
    writes.push('verify');
    if (body.challenge !== pending.challenge || mode === 'wrong') return reply({ success: false, message: 'That code is incorrect. Check the latest email and try again.' }, 400);
    if (mode === 'delivery') return reply({ success: false, message: 'Staff verification is unavailable. Return to sign-in.' }, 503);
    return ok({ token: 'synthetic-verified-session', user: actor() });
  }
  if (path === '/api/auth/staff-mfa/resend') {
    writes.push('resend');
    if (mode === 'delivery') return reply({ success: false, message: 'The verification email could not be delivered. Return to sign-in and try again.' }, 503);
    pending.resendAt = new Date(Date.now() + 60000).toISOString(); return ok({ ...pending });
  }
  if (path === '/api/users/me') return ok(actor());
  if (path === '/api/academic/state') return ok({ terms: [], subjects: [], currentTermId: null, continueModule: null, incompleteCount: 0, needsReview: [] });
  if (path === '/api/academic/plans') return ok({ items: [], subjects: [], nudges: [], nudgesEnabled: false });
  if (path.includes('/unread-count')) return ok({ count: 0 });
  if (path.includes('/notifications')) return ok({ notifications: [], unreadCount: 0 });
  return ok([]);
};
function Bridge() { const auth = useAuth(), navigate = useNavigate(); useEffect(() => { bridge = { auth, navigate }; }); return null; }
const pause = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms));
function assert(value, label) { if (!value) throw new Error(label); }
async function until(check, label) { for (let i = 0; i < 100; i++) { if (check()) return; await pause(); } throw new Error(label); }
function fill(id, value) { const el = document.getElementById(id); assert(el, 'Input exists: ' + id); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); }
const button = label => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === label);
async function capture(name) {
  await pause(200); window.scrollTo(0, 0);
  assert(document.documentElement.scrollWidth <= innerWidth + 1, 'No horizontal overflow: ' + name);
  assert(visualViewport.scale === 1 && devicePixelRatio === 1, '100% zoom');
  assert(innerWidth === window.__acadovaExpectedViewport.width && innerHeight === window.__acadovaExpectedViewport.height, 'Exact viewport');
  window.__acadovaCaptureDetails = { name, width: innerWidth, height: innerHeight, scale: visualViewport.scale, syntheticApi: true };
  if (window.__acadovaCaptureEnabled) { window.__acadovaCapture = name; await until(() => !window.__acadovaCapture, 'Screenshot ' + name); }
}
async function start(selectedRole) {
  role = selectedRole; bridge.auth.logout(); bridge.navigate('/login');
  await until(() => document.getElementById('login-email'), 'Login form');
  fill('login-email', 'synthetic@example.test'); fill('login-password', 'Synthetic-test-only!'); await pause();
  document.querySelector('form').requestSubmit();
}
document.getElementById('result').hidden = true;
localStorage.removeItem('acadova_token'); localStorage.removeItem('acadova_user'); sessionStorage.clear();
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge /><App /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try {
  await until(() => bridge && !bridge.auth.loading, 'Auth initialized');
  await start('admin'); await until(() => document.getElementById('staff-mfa-code'), 'Admin second step');
  assert(!bridge.auth.isAuthenticated && !localStorage.getItem('acadova_token'), 'Password does not authenticate');
  assert(document.body.textContent.includes('s***@example.test') && !document.body.textContent.includes('synthetic@example.test'), 'Masked destination');
  assert(document.activeElement.id === 'staff-mfa-code', 'Code entry focus');
  assert(document.getElementById('staff-mfa-code').autocomplete === 'one-time-code', 'Autofill and paste supported');
  assert([...document.querySelectorAll('.staff-mfa button')].every(el => el.getBoundingClientRect().height >= 44), 'Touch targets');
  await capture('admin-mfa');
  fill('staff-mfa-code', '111111'); await pause(); document.querySelector('.staff-mfa form').requestSubmit();
  await until(() => document.querySelector('.staff-mfa [role=alert]'), 'Wrong-code feedback');
  assert(!bridge.auth.isAuthenticated, 'Invalid code cannot authenticate'); await capture('mfa-invalid');
  // Reopening the route restores only the limited pending challenge, never a session.
  bridge.navigate('/login'); await until(() => document.getElementById('login-email'), 'Back navigation'); bridge.navigate('/staff-verify');
  await until(() => document.getElementById('staff-mfa-code'), 'Pending restored');
  assert(!bridge.auth.isAuthenticated, 'Recovery does not grant access');
  mode = 'correct'; fill('staff-mfa-code', '222222'); await pause(); document.querySelector('.staff-mfa form').requestSubmit();
  await until(() => bridge.auth.isAuthenticated && location.pathname === '/admin', 'Admin verified destination');
  assert(!sessionStorage.getItem('acadova_pending_staff_mfa'), 'Pending cleared');
  await start('moderator'); await until(() => document.getElementById('staff-mfa-code'), 'Moderator second step'); await capture('moderator-mfa');
  fill('staff-mfa-code', '222222'); await pause(); document.querySelector('.staff-mfa form').requestSubmit();
  await until(() => bridge.auth.isAuthenticated && location.pathname === '/moderator', 'Moderator verified destination');
  await start('admin'); await until(() => document.getElementById('staff-mfa-code'), 'Fresh login re-challenges');
  // Advance only the synthetic receipt to exercise resend/expiry states without waiting.
  bridge.navigate('/login'); await until(() => document.getElementById('login-email'), 'Leave challenge before resend'); pending.resendAt = new Date(Date.now() - 1000).toISOString(); sessionStorage.setItem('acadova_pending_staff_mfa', JSON.stringify(pending)); bridge.navigate('/staff-verify');
  await until(() => button('Resend Code'), 'Resend cooldown completed'); mode = 'delivery'; button('Resend Code').click();
  await until(() => document.querySelector('.staff-mfa [role=alert]'), 'Delivery failure feedback'); await capture('mfa-delivery-error');
  assert(!bridge.auth.isAuthenticated, 'Delivery error grants no access');
  bridge.navigate('/login'); await until(() => document.getElementById('login-email'), 'Leave challenge before expiry'); pending.expiresAt = new Date(Date.now() - 1000).toISOString(); sessionStorage.setItem('acadova_pending_staff_mfa', JSON.stringify(pending)); bridge.navigate('/staff-verify');
  await until(() => document.body.textContent.includes('Your verification has expired'), 'Timeout state'); await capture('mfa-expired');
  await start('student'); await until(() => bridge.auth.isAuthenticated && location.pathname === '/dashboard', 'Student direct login unchanged');
  assert(writes.filter(x => x === 'verify').length === 3, 'Expected verification calls only');
  document.getElementById('result').textContent = 'PASS: staff MFA UI, both roles, errors, expiry, recovery, keyboard labels, Student direct login and responsive branding';
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.message; }
