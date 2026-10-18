// Real React + authenticated local Express routes + isolated MongoDB. No mocked API responses.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import '../src/index.css';
const config = window.__acadovaLocalTest;
const nativeFetch = window.fetch.bind(window); const requests = [];
const endpoint = new URL(config.url);
if (endpoint.hostname !== '127.0.0.1' || endpoint.protocol !== 'http:') throw new Error('Local fixture API required');
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
// oxlint-disable-next-line react/only-export-components
export function Bridge() { const auth = useAuth(); const navigate = useNavigate(); const route = useLocation(); useEffect(() => { bridge = { auth, navigate, route }; }, [auth, navigate, route]); return null; }
const pause = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };
const until = async (check, message) => { for (let i = 0; i < 180; i++) { if (check()) return; await pause(); } throw new Error(message); };
const button = (label, root = document) => [...root.querySelectorAll('button')].find((el) => el.getClientRects().length && el.textContent.trim() === label);
const fill = (selector, value) => {
  const el = document.querySelector(selector);
  const prototype = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
};
const submit = (form) => { assert(form.checkValidity(), 'Authoring form valid'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); };
const confirm = async (label) => { await until(() => button(label, document.querySelector('[role="dialog"]') || document), 'Confirmation: ' + label); button(label, document.querySelector('[role="dialog"]')).click(); };
const capture = async (name) => {
  window.scrollTo({ top: 0, behavior: 'instant' }); await pause();
  assert(document.documentElement.scrollWidth <= innerWidth + 1, 'Live page horizontal overflow: ' + name);
  if (window.__acadovaCaptureEnabled) { window.__acadovaCapture = name; await until(() => !window.__acadovaCapture, 'Capture ' + name); }
};
const errors = [];
window.addEventListener('error', (event) => errors.push(event.message));
window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason)));
localStorage.setItem('acadova_token', config.token);
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge /><App /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try {
  await until(() => bridge?.auth.user?.role === 'moderator', 'Database-backed Moderator authentication');
  bridge.navigate(`/moderator/learning?topic=${config.topicId}#manage-panel-resources`);
  await until(() => button('Create Resource') && !button('Create Resource').disabled, 'Topic workspace');
  button('Create Resource').click(); await until(() => document.getElementById('staff-resource-title'), 'Resource editor');
  assert(document.getElementById('staff-resource-topic').value === config.topicId && document.getElementById('staff-resource-topic').disabled, 'Topic context bound');
  fill('#staff-resource-title', 'Live defense lesson'); fill('#staff-resource-description', 'A synthetic lesson for the defense rehearsal.'); fill('#staff-resource-text', 'Variables store values used in a program.'); await pause();
  submit(document.getElementById('staff-resource-title').closest('form'));
  await until(() => document.querySelector('.learning-management-item')?.textContent.includes('Live defense lesson'), 'Official draft saved');
  assert(document.querySelector('.learning-management-item').textContent.includes('Draft') && document.querySelector('.learning-management-item').textContent.includes('Official staff resource'), 'Actual draft and origin displayed');
  document.querySelector('.learning-management-item button').click(); await until(() => button('Publish draft'), 'Draft preview');
  button('Publish draft').click(); await confirm('Publish resource');
  await until(() => document.querySelector('.learning-management-item')?.textContent.includes('Published'), 'Explicit publish succeeded');
  assert(!button('Approve & publish'), 'Official publication separate from contribution approval');
  await capture('live-official-resource');
  document.getElementById('manage-tab-modules').click(); await until(() => button('Create Module') && !button('Create Module').disabled, 'Publication refresh completes'); button('Create Module').click();
  await until(() => document.getElementById('module-title'), 'Module editor');
  fill('#module-title', 'Live defense module'); fill('#module-description', 'Read the lesson and pass its assessment.'); await pause();
  await until(() => button('Add Live defense lesson'), 'Published resource available in Module editor: ' + document.getElementById('module-topic')?.value);
  button('Add Live defense lesson').click(); await pause(); fill('#module-assessment', config.assessmentId); await pause();
  submit(document.getElementById('module-title').closest('form'));
  await until(() => document.querySelector('#manage-panel-modules .learning-management-item')?.textContent.includes('Live defense module') && button('Publish'), 'Module draft persisted');
  button('Publish').click(); await confirm('Publish module');
  await until(() => document.querySelector('#manage-panel-modules .learning-management-item')?.textContent.includes('Published'), 'Module published');
  document.querySelector('.learning-module-outline summary').click(); await pause();
  assert(document.querySelector('.learning-module-outline').textContent.includes('Live defense assessment'), 'Actual attached assessment displayed');
  await capture('live-topic-module');
  localStorage.setItem('acadova_token', config.studentToken); await bridge.auth.refreshUser();
  await until(() => bridge.auth.user?.role === 'student', 'Authoritative Student identity');
  bridge.navigate(`/learning?topic=${config.topicId}`);
  await until(() => document.querySelector('.learning-module-summary button'), 'Student Topic');
  document.querySelector('.learning-module-summary button').click();
  await until(() => button('Mark as Complete') && !button('Mark as Complete').disabled, 'Published lesson accessible');
  assert(document.querySelector('.learning-progress').textContent.includes('0%'), 'Reading records no completion');
  button('Mark as Complete').focus(); window.__acadovaKey = 'Enter'; await until(() => !window.__acadovaKey, 'Native keyboard completion');
  await until(() => button('Completed') && document.querySelector('.learning-progress').textContent.includes('50%'), 'MongoDB lesson evidence updates module progress');
  const moduleUrl = bridge.route.pathname + bridge.route.search;
  await capture('live-student-completion');
  await until(() => document.querySelector('.learning-assessment a[aria-label^="Take assessment"]'), 'Attached assessment metadata loaded');
  document.querySelector('.learning-assessment a[aria-label^="Take assessment"]').click();
  await until(() => document.querySelector('.assessment-workspace form'), 'Real assessment opened');
  for (let i = 0; i < 3; i++) document.querySelector(`input[name="question-${i}"]`).click();
  submit(document.querySelector('.assessment-workspace form'));
  await until(() => document.querySelector('.assessment-result')?.textContent.includes('+20 credits earned'), 'Server grading and actual once-only credit reward');
  bridge.navigate(moduleUrl);
  await until(() => document.querySelector('.learning-progress')?.textContent.includes('100%'), 'Real attached pass completes module');
  assert(document.querySelector('.learning-assessment-achievement').textContent.includes('Passed'), 'Real pass displayed');
  await capture('live-student-module-complete');
  bridge.navigate(`/learning?topic=${config.topicId}`);
  await until(() => document.querySelector('.learning-topic-progress')?.textContent.includes('100%'), 'Topic progress persisted');
  assert(document.querySelector('.learning-topic-progress').textContent.includes('1 of 1 published modules completed'), 'Topic completion totals');
  await capture('live-student-topic-complete');
  assert(requests.filter((row) => row.path.endsWith('/complete') && row.status === 200).length === 1, 'Exactly one completion request');
  assert(errors.length === 0, errors.join('; '));
  document.getElementById('result').textContent = `PASS: ${innerWidth}x${innerHeight} live Learning demo - Moderator Draft/Publish, Topic module/assessment, Student completion 50%, authoritative pass/reward and Module/Topic 100%`;
  document.getElementById('result').hidden = true;
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.stack; }
