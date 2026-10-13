// Real App + AuthProvider + Express routers + a fresh isolated MongoDB replica set.
// All accounts and ledger records are synthetic and supplied only by the guarded test.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import '../src/index.css';

const config = window.__acadovaLocalTest;
const endpoint = new URL(config.url);
if (endpoint.hostname !== '127.0.0.1' || endpoint.protocol !== 'http:') throw new Error('Loopback fixture required');
const originalFetch = window.fetch.bind(window); const requests = [];
window.fetch = async (url, options = {}) => {
  const target = new URL(String(url), location.origin);
  if (!target.pathname.startsWith('/api/')) {
    if (target.origin !== location.origin) throw new Error('External requests are disabled in the isolated fixture');
    return originalFetch(url, options);
  }
  const response = await originalFetch(new URL(target.pathname + target.search, endpoint), options);
  requests.push({ path: target.pathname, query: target.search, status: response.status });
  return response;
};
let bridge;
export function Bridge() { const auth = useAuth(); const navigate = useNavigate(); const route = useLocation(); useEffect(() => { bridge = { auth, navigate, route }; }, [auth, navigate, route]); return null; }
const pause = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, label) => { if (!value) throw new Error(label); };
const until = async (check, label) => { for (let i = 0; i < 240; i++) { if (check()) return; await pause(); } throw new Error(label); };
const button = label => [...document.querySelectorAll('button')].find(el => el.getClientRects().length && el.textContent.trim() === label);
const metric = label => [...document.querySelectorAll('.dashboard-kpi')].find(el => el.textContent.includes(label))?.querySelector('strong')?.textContent;
const loaded = () => document.querySelector('.dashboard-refresh-button') && !document.querySelector('.dashboard-refresh-button').disabled;
const fill = (selector, value) => { const el = document.querySelector(selector); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); };
const go = async path => { bridge.navigate(path); await until(() => bridge.route.pathname === (path.startsWith('/admin/security') || path.startsWith('/admin/audit-logs') ? '/admin/trust-activity' : path.split('?')[0]), 'Navigation ' + path); await pause(100); };
const layout = () => assert(document.documentElement.scrollWidth <= innerWidth + 1, 'No document overflow');
const capture = async name => { if (!window.__acadovaCaptureEnabled) return; window.scrollTo(0, 0); await pause(100); window.__acadovaCapture = name; await until(() => !window.__acadovaCapture, 'Capture ' + name); };
localStorage.setItem('acadova_token', config.token);
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge /><App /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try {
  await until(() => bridge?.auth.user?.role === 'admin', 'Real Admin profile'); await go('/admin'); await until(() => metric('Total Users') === '3' && loaded(), 'Real Admin overview counts');
  assert(metric('Students') === '1' && metric('Moderators') === '1', 'Account role counts match isolated records');
  assert(document.querySelector('.attention-list').textContent.includes('Pending Study Set reviews') && document.querySelectorAll('.attention-list .record-count')[2].textContent === '1', 'Actual pending Study Set count');
  assert(document.querySelector('.ledger-credit')?.textContent.includes('+20') && document.querySelector('.dashboard-records') && document.body.textContent.includes(config.studentName), 'Actual ledger participant and signed reward'); layout(); await capture('live-admin-overview');
  await go('/admin/moderation'); await until(() => document.querySelector('.moderation-toolbar a'), 'Real moderation toolbar');
  document.querySelector('.moderation-toolbar a').click();
  await until(() => bridge.route.pathname === '/admin/disputes' && document.querySelectorAll('.session-dispute-card').length >= 2, 'Admin dispute view loads real exceptions');
  assert(document.querySelector('.staff-eyebrow').textContent === 'Administration / Sessions', 'Admin dispute breadcrumb');
  assert(requests.some(row => row.path === '/api/moderator/sessions/disputed' && row.status === 200), 'Existing role-authorized dispute API');
  assert(document.querySelector('.session-dispute-list').textContent.includes('Explicit dispute'), 'Actual disputed session rendered'); layout(); await capture('live-admin-disputes');
  bridge.navigate(-1); await until(() => bridge.route.pathname === '/admin/moderation', 'Real dispute Back navigation');
  await go('/admin/credits'); await until(() => document.querySelector('#targetStudent option[value]') && document.querySelector('#startingCreditGrant'), 'Real Credit rules and Student picker');
  assert(!document.body.textContent.includes('Invalid query'), 'Credit API validation compatible'); layout();
  await go('/admin/trust-activity'); await until(() => metric('Protection Events') === '1' && document.querySelectorAll('tbody tr').length === 5 && loaded(), 'Real scoped Audit and Trust summary');
  assert([...document.querySelectorAll('.trust-metadata')].some(el => el.textContent.includes('synthetic-reference')), 'Approved record references and decision metadata remain accessible');
  assert(metric('Admin Actions') === '2' && metric('Active Cooldowns') === '1', 'Real protection and account counts'); await capture('live-trust-activity');
  fill('input[type=search]', 'MaRiA'); await until(() => document.querySelectorAll('tbody tr').length === 3 && loaded(), 'Server-side partial actor-name match within selected dates');
  button('Clear filters').click(); await until(() => document.querySelectorAll('tbody tr').length === 5 && loaded(), 'Server-side clear filters');
  document.getElementById('trust-tab-activity').focus(); window.__acadovaKey = 'ArrowRight'; await until(() => !window.__acadovaKey, 'Native Security tab key');
  await until(() => document.querySelectorAll('tbody tr').length === 1 && document.querySelector('tbody')?.textContent.includes('System') && loaded(), 'Real System security event scope');
  window.__acadovaKey = 'ArrowRight'; await until(() => !window.__acadovaKey, 'Native Protection tab key'); await until(() => document.querySelector('.protection-counts'), 'Real Login protection panel');
  assert(document.querySelector('.protection-counts').textContent.includes('Active cooldowns now1'), 'Existing Security counts preserved');
  await go('/admin/security?category=cooldown&period=7d'); await until(() => document.querySelectorAll('tbody tr').length === 1 && loaded(), 'Legacy Security rolling query works against actual API'); layout();
  await go('/admin/assessments'); button('Create / edit').click();
  await until(() => document.querySelectorAll('.assessment-question').length === 3, 'Real assessment editor');
  fill('#assessment-title', 'Isolated C1 assessment draft'); fill('#assessment-topic', 'Java');
  for (let i = 0; i < 3; i++) {
    fill(`#assessment-prompt-${i}`, `Isolated question prompt ${i + 1}`);
    for (let j = 0; j < 3; j++) fill(`#assessment-option-${i}-${j}`, `Isolated answer ${j + 1}`);
  }
  button('Add question').click(); await until(() => document.querySelectorAll('.assessment-question').length === 4, 'Real editor adds fourth question');
  document.querySelectorAll('.assessment-question')[3].querySelectorAll('button')[2].click();
  await until(() => document.querySelectorAll('.assessment-question').length === 3, 'Real editor removes fourth question');
  button('Create draft').click(); await until(() => document.querySelector('#assessment-title').value === '' && button('Create draft')?.disabled === false, 'Draft saved through actual API');
  assert(requests.some(row => row.path === '/api/moderator/assessments' && row.status === 201), 'Real assessment draft accepted');
  button('All assessments').click(); await until(() => document.querySelector('#assessment-management-panel-drafts').textContent.includes('Isolated C1 assessment draft'), 'Persisted draft in real library'); layout();
  await bridge.auth.login(config.moderatorEmail, config.password); await until(() => bridge.auth.user?.role === 'moderator' && bridge.route.pathname === '/moderator', 'Real Moderator login');
  await until(() => metric('Pending Reviews') === '3' && loaded(), 'Real Moderator overview');
  assert(metric('Reported Content') === '2' && metric('Session Disputes') === '1' && metric('Decisions Today') === '3', 'Moderation summaries match database states');
  assert(document.querySelector('.staff-queue-list').textContent.includes('Explicit referral') && !document.querySelector('.staff-queue-list').textContent.includes('Normal confirmation'), 'Only session exceptions enter Moderator queue');
  assert(document.body.textContent.includes(config.moderatorName) && !document.body.textContent.includes('PRIVATE_'), 'Curated decisions exclude confidential fixture metadata'); await capture('live-moderator-overview');
  button('30 days').click(); await until(() => location.search.includes('days=30') && loaded()
    && requests.some(row => row.path === '/api/moderator/overview' && row.query.includes('days=30') && row.status === 200)
    && document.querySelectorAll('.analytics-data-table tbody tr').length === 30, 'Real workload date query and rendered daily values');
  assert(requests.some(row => row.path === '/api/moderator/overview' && row.query.includes('days=30') && row.status === 200), 'Workload period reaches authorized backend'); layout();
  const denied = await window.fetch('/api/admin/trust-summary', { headers: { Authorization: 'Bearer ' + localStorage.getItem('acadova_token') } }); assert(denied.status === 403, 'Actual database role rejects Admin access');
  assert(requests.filter(row => row.status >= 400).every(row => row.path === '/api/admin/trust-summary' && row.status === 403), 'No unexpected API integration failures');
  document.getElementById('result').textContent = 'PASS: Real local Express/MongoDB Admin counts, ledger names, Credits rules/picker, Trust summary/search/scopes/legacy rolling filters, Moderator login/queue/trend, native keyboard tabs and server role denial. Synthetic isolated data only; no production/provider verification.';
} catch(error) { document.getElementById('result').textContent = 'FAIL: Real local ' + error.message + ' | ' + location.pathname + location.search + ' | calls=' + JSON.stringify(requests.slice(-8)) + ' | text=' + document.querySelector('main')?.textContent.slice(-500); }
