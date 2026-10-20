// Actual shell/router/browser, synthetic GET-only HTTP. No provider or database.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import '../src/index.css';
const tid = '507f1f77bcf86cd799439020';
const actor = { _id: '507f1f77bcf86cd799439011', name: 'Synthetic QA Student', email: 'sidebar@example.test', role: 'student', emailVerified: true, credits: 100, skillsToLearn: [], skillsToTeach: [], onboardingFinishedAt: '2026-10-01' };
const subjects = ['Network Security', 'Database Systems', 'Web Development', 'Discrete Mathematics'].map((name, i) => ({ id: String(30 + i).padStart(24, '0'), name, termId: tid, courseCode: `QA ${i + 1}`, moduleCount: 0, completedCount: 0 }));
const reply = data => new Response(JSON.stringify({ success: true, data }), { status: 200 });
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (options.method && options.method !== 'GET') throw new Error('Sidebar fixture must not perform writes.');
  if (path === '/api/users/me') return reply(actor);
  if (path.startsWith('/api/notifications')) return reply([]);
  if (path === '/api/academic/state') return reply({ terms: [{ id: tid, startYear: 2026, endYear: 2027, semester: 'First', displayName: 'SY 2026-2027 / First Semester' }], currentTermId: tid, subjects, continueModule: null, incompleteCount: 0, needsReview: [] });
  if (path === '/api/academic/plans') return reply({ items: [], subjects, nudgesEnabled: true, nudges: [] });
  if (path === '/api/growth') return reply({ active: false, totalExp: null, events: [] });
  if (['/api/sessions', '/api/study-sets', '/api/study-circles', '/api/study-circles/volunteers'].includes(path)) return reply([]);
  throw new Error('Unexpected synthetic sidebar request: ' + path);
};
const before = new URLSearchParams(location.search).get('capture') === '/before';
const phase = sessionStorage.getItem('sidebar-phase');
if (!phase) localStorage.setItem('acadova_sidebar_collapsed', innerWidth > 1024 ? '0' : '1');
localStorage.setItem('acadova_token', 'synthetic-sidebar-only');
let bridge;
export function Bridge() { const auth = useAuth(), navigate = useNavigate(); useEffect(() => { bridge = { auth, navigate }; }, [auth, navigate]); return null; }
const pause = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms));
function assert(value, message) { if (!value) throw new Error(message); }
async function until(check, message) { for (let i = 0; i < 150; i++) { if (check()) return; await pause(); } throw new Error(message); }
const sidebar = () => document.querySelector('.student-sidebar');
const toggle = () => sidebar().querySelector('.ac-sidebar-toggle');
const links = () => [...sidebar().querySelectorAll('.student-nav a')];
const rect = element => { const { left, right, width, top, bottom, height } = element.getBoundingClientRect(); return { left, right, width, top, bottom, height }; };
function metrics() { return { viewport: { width: innerWidth, height: innerHeight }, sidebar: rect(sidebar()), main: rect(document.querySelector('main')), header: document.querySelector('.student-utility-bar') ? rect(document.querySelector('.student-utility-bar')) : null, content: rect(document.querySelector('main > .container')), hero: document.querySelector('.ac-hero') ? rect(document.querySelector('.ac-hero')) : null, panels: [...document.querySelectorAll('.ac-subject-section,.ac-metrics,.ac-home-bottom')].map(el => ({ className: el.className, ...rect(el), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, descendants: [...el.querySelectorAll('.ac-section-title a,.ac-section-title button,.academic-subject')].map(child => ({ className:child.className,...rect(child) })), children: [...el.children].map(child => ({className:child.className,...rect(child)})) })) }; }
async function capture(name) { await pause(250); window.scrollTo({ top: 0, behavior: 'instant' }); window.__acadovaCaptureDetails = { name, ...metrics() }; if (!window.__acadovaCaptureEnabled) return; window.__acadovaCapture = name; await until(() => !window.__acadovaCapture, 'Capture: ' + name); }
async function key(value) { window.__acadovaKey = value; await until(() => !window.__acadovaKey, 'Native key ' + value); await pause(); }
function geometry(expected) {
  const m = metrics(); assert(Math.abs(m.sidebar.width - expected) < 1, `Sidebar width ${m.sidebar.width}, expected ${expected}`);
  assert(Math.abs(m.main.left - m.sidebar.right) < 1, 'Main starts at actual rail edge');
  assert(Math.abs(m.header.left - m.sidebar.right) < 1, 'Sticky header follows actual rail edge');
  assert(Math.abs(m.main.right - innerWidth) <= 16, 'Main fills the remaining viewport');
  assert(m.content.left >= m.sidebar.right && (!m.hero || m.hero.left >= m.sidebar.right), 'No content/hero overlap');
  assert(document.documentElement.scrollWidth <= innerWidth, 'No horizontal overflow');
  for (const panel of m.panels) { assert(panel.right <= m.content.right + 1 && panel.left >= m.main.left, 'Panel remains inside available content: ' + JSON.stringify(panel)); assert(panel.scrollWidth <= panel.clientWidth + 1, 'No clipped panel children: ' + JSON.stringify(panel)); for (const child of panel.descendants) assert(child.left >= panel.left - 1 && child.right <= panel.right + 1, 'Descendant fits panel: ' + JSON.stringify({panel,child})); }
}
const destinations = ['/dashboard', '/subjects', '/study-sets', '/study-together'];
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge/><App/></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try {
  await until(() => bridge?.auth.isAuthenticated, 'Synthetic Student auth'); bridge.navigate('/dashboard');
  await until(() => document.querySelector('.ac-hero') && links().length === 4, 'Dashboard and primary navigation');
  if (innerWidth <= 1024) {
    assert(!sidebar().getClientRects().length && !toggle(), 'Desktop rail/toggle hidden on mobile');
    assert(document.querySelector('main').getBoundingClientRect().left === 0, 'No desktop gutter on mobile');
    assert(localStorage.getItem('acadova_sidebar_collapsed') === '1', 'Mobile does not rewrite desktop preference');
    const bottom = document.querySelector('.student-mobile-bottom');
    assert([...bottom.querySelectorAll('a')].map(a => a.getAttribute('href')).join('|') === destinations.join('|'), 'Mobile routes unchanged');
    for (const path of destinations) { bottom.querySelector(`a[href="${path}"]`).click(); await until(() => location.pathname === path && bottom.querySelector('a[aria-current="page"]')?.getAttribute('href') === path, 'Mobile route ' + path); await pause(); }
    document.querySelector('button[aria-label="More navigation"]').click(); await until(() => document.querySelector('[role=dialog]'), 'Existing mobile navigation drawer');
    assert(document.querySelector('[role=dialog] a[href="/profile"]'), 'Secondary routes preserved');
    await key('Escape'); await until(() => !document.querySelector('[role=dialog]'), 'Mobile drawer closes with Escape');
    assert(document.activeElement.getAttribute('aria-label') === 'More navigation', 'Mobile drawer restores focus');
    bridge.navigate('/dashboard'); await until(() => document.querySelector('.ac-hero'), 'Mobile home'); await capture('mobile');
    assert(document.documentElement.scrollWidth <= innerWidth, 'Mobile no overflow');
    document.getElementById('result').textContent = 'PASS: 375px mobile routes, drawer/Escape/focus, hidden desktop rail, unchanged persisted preference and no overflow';
  } else if (before) {
    await capture('before-expanded'); toggle().click(); await pause(350); await capture('before-collapsed');
    document.getElementById('result').textContent = 'PASS: captured existing baseline states and actual geometry; this is NOT a layout pass';
  } else if (!phase) {
    geometry(256); await capture('expanded'); const expanded = metrics();
    assert(toggle().getAttribute('aria-label') === 'Collapse sidebar' && toggle().getAttribute('aria-expanded') === 'true', 'Expanded toggle semantics');
    assert(toggle().querySelector('svg.lucide-panel-left-close'), 'Panel-close icon');
    const b = rect(toggle()), h = rect(document.querySelector('.ac-sidebar-header'));
    assert(b.width <= 44 && b.height <= 44 && b.right <= h.right + 1, 'Compact top-right header toggle');
    toggle().focus(); await key('Enter'); await pause(300); geometry(76);
    const collapsed = metrics(); assert(collapsed.main.width > expanded.main.width + 175, 'Main gains released sidebar width');
    assert(collapsed.content.width > expanded.content.width + 175, 'Content container uses released width');
    assert(toggle().getAttribute('aria-label') === 'Expand sidebar' && toggle().querySelector('svg.lucide-panel-left-open'), 'Panel-open icon/label');
    assert(localStorage.getItem('acadova_sidebar_collapsed') === '1', 'Existing persistence key retained');
    for (const link of links()) {
      const r = rect(link); assert(r.left >= 0 && r.right <= 76 && r.width >= 44, 'Rail link fits and has adequate target');
      assert(link.getAttribute('aria-label') && link.title, 'Icon links retain names and tooltip fallback');
    }
    const active = sidebar().querySelector('[aria-current=page]'); assert(active && getComputedStyle(active).backgroundColor !== 'rgba(0, 0, 0, 0)', 'Active highlight visible in rail');
    links()[1].focus(); await until(() => document.querySelector('[role=tooltip]'), 'Keyboard-visible tooltip');
    const tip = document.querySelector('[role=tooltip]'); assert(tip.textContent === 'My Subjects' && tip.id === document.activeElement.getAttribute('aria-describedby'), 'Tooltip associated with focused link');
    assert(rect(tip).left >= 76, 'Tooltip not clipped inside rail');
    await key('Escape'); await until(() => !document.querySelector('[role=tooltip]'), 'Escape dismisses tooltip');
    toggle().focus(); await capture('collapsed');
    for (const path of destinations) { links().find(a => a.getAttribute('href') === path).click(); await until(() => location.pathname === path && sidebar().querySelector('[aria-current=page]')?.getAttribute('href') === path, 'Rail route ' + path); await pause(150); geometry(76); }
    bridge.navigate('/dashboard'); await until(() => document.querySelector('.ac-hero'), 'Home before refresh');
    sessionStorage.setItem('sidebar-phase', 'collapsed-refresh'); location.reload(); await new Promise(() => {});
  } else if (phase === 'collapsed-refresh') {
    geometry(76); assert(toggle().getAttribute('aria-expanded') === 'false', 'Collapsed survives actual refresh');
    toggle().focus(); await key('Space'); await pause(300); geometry(256); assert(localStorage.getItem('acadova_sidebar_collapsed') === '0', 'Expanded preference restored');
    sessionStorage.setItem('sidebar-phase', 'expanded-refresh'); location.reload(); await new Promise(() => {});
  } else {
    geometry(256); assert(toggle().getAttribute('aria-expanded') === 'true', 'Expanded survives actual refresh');
    document.getElementById('result').textContent = 'PASS: sidebar actual 256/76px, content/header reflow, no overlap, four routes/active states, panel toggles, keyboard/tooltips/Escape and both real-refresh preferences';
  }
  document.getElementById('result').hidden = true;
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.message; }
