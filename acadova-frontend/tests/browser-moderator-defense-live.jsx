// Real React, authenticated Express endpoints and isolated synthetic MongoDB records.
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
if (endpoint.hostname !== '127.0.0.1' || endpoint.protocol !== 'http:') throw new Error('Isolated loopback API required');
const nativeFetch = window.fetch.bind(window); const requests = [];
window.fetch = async (url, options = {}) => {
  const target = new URL(String(url), location.origin);
  if (!target.pathname.startsWith('/api/')) {
    if (target.origin !== location.origin) throw new Error('External requests forbidden');
    return nativeFetch(url, options);
  }
  const response = await nativeFetch(new URL(target.pathname + target.search, endpoint), options);
  requests.push({ path: target.pathname, method: options.method || 'GET', status: response.status });
  return response;
};
let bridge;
export function Bridge() { const auth = useAuth(); const navigate = useNavigate(); const route = useLocation(); useEffect(() => { bridge = { auth, navigate, route }; }, [auth, navigate, route]); return null; }
const pause = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };
const until = async (check, message) => { for (let i = 0; i < 200; i++) { if (check()) return; await pause(); } throw new Error(message); };
const button = (label, root = document) => [...root.querySelectorAll('button')].find(el => el.getClientRects().length && el.textContent.trim() === label);
const card = () => document.getElementById(`staff-review-${config.sessionId}`);
const layout = () => assert(document.documentElement.scrollWidth <= innerWidth + 1, 'Horizontal overflow');
localStorage.setItem('acadova_token', config.token);
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge /><App /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try {
  await until(() => bridge?.auth.user?.role === config.role, 'Authenticated authoritative staff profile');
  bridge.navigate(`/${config.role}/disputes?session=${config.sessionId}`);
  await until(() => card() && button('View messages and ledger', card()), 'Disputed case loaded');
  assert(document.body.textContent.includes('self-reported attendance'), 'Check-ins not presented as provider proof');
  button('View messages and ledger', card()).focus(); window.__acadovaKey = 'Enter';
  await until(() => !window.__acadovaKey, 'Native keyboard opens evidence');
  await until(() => card()?.textContent.includes('We discussed arrays; please review the exercise.'), 'Real persisted message');
  await until(() => card()?.textContent.includes('No audit entries recorded for this case.'), 'Honest pre-decision audit state');
  const action = config.resolution === 'confirm_session' ? 'Confirm session and settle credits' : 'Mark session invalid';
  button(action, card()).click();
  await until(() => document.activeElement.id === `resolution-note-${config.sessionId}`, 'Missing reason focuses required field');
  const note = document.activeElement;
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(note, 'Reviewed participant accounts and submitted work for the defense case.');
  note.dispatchEvent(new Event('input', { bubbles: true })); await pause();
  button(action, card()).click(); await until(() => document.querySelector('[role="dialog"]'), 'Decision confirmation');
  button('Cancel').click(); await pause();
  assert(!requests.some(row => row.path.endsWith('/resolve')), 'Cancel does not resolve');
  button(action, card()).click(); await until(() => button('Resolve dispute'), 'Repeat confirmation');
  button('Resolve dispute').click();
  await until(() => requests.some(row => row.path.endsWith('/resolve') && row.status === 200) && !card(), 'Real transactional decision succeeds');
  const view = document.querySelector('.staff-filter-select select');
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(view, 'resolved');
  view.dispatchEvent(new Event('change', { bubbles: true }));
  await until(() => button('View case record and audit', card() || document), 'Closed case loaded');
  assert(!button('Confirm session and settle credits', card()) && !button('Mark session invalid', card()), 'Closed case cannot settle again');
  button('View case record and audit', card()).click();
  await until(() => card()?.textContent.includes('Recorded reason:') && card()?.textContent.includes('Dispute resolved'), 'Durable audit visible from actual database');
  assert(card().textContent.includes(`${config.role} Fixture`) && card().textContent.includes(config.sessionId), 'Audit actor and target inspectable');
  assert(card().textContent.includes(config.resolution === 'confirm_session' ? 'session_payment: 20 credits' : 'No Session credit transaction.'), 'Correct ledger displayed');
  assert(requests.filter(row => row.path.endsWith('/resolve')).length === 1, 'Exactly one mutation');
  card().querySelectorAll('details').forEach(el => { el.open = true; });
  card().querySelector('.session-review-messages').scrollIntoView({ block: 'start' }); await pause(); layout();
  document.getElementById('result').textContent = `PASS: Real ${config.role} dispute, evidence, reason, Cancel, resolution, persisted audit and ledger; closed-case safety at ${innerWidth}px.`;
} catch (error) {
  document.getElementById('result').textContent = 'FAIL: Moderator defense ' + error.message + ' | ' + JSON.stringify(requests.slice(-8));
}
