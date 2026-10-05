// Real components and CSS; isolated API fixtures, never a real account or DB.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AuthContext from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import { useConfirm } from '../src/context/confirmAccess';
import AppLayout from '../src/layouts/AppLayout';
import StaffLayout from '../src/layouts/StaffLayout';
import DashboardPage from '../src/pages/DashboardPage';
import LearningPage from '../src/pages/LearningPage';
import SessionsPage from '../src/pages/SessionsPage';
import ProfilePage from '../src/pages/ProfilePage';
import '../src/index.css';

const assert = (ok, message) => { if (!ok) throw new Error(message); };
const pause = () => new Promise((resolve) => setTimeout(resolve, 30));
const until = async (check, message) => { for (let i = 0; i < 100; i++) { if (check()) return; await pause(); } throw new Error(message); };
const user = { _id: 'student', name: 'José Dela Cruz', role: 'student', credits: 100, onboardingFinishedAt: '2026-10-01', skillsToLearn: [], skillsToTeach: [] };
let writes = 0;
let established = false;
window.fetch = async (url, options = {}) => {
  if (options.method && options.method !== 'GET') writes++;
  const peer = { _id: 'peer', name: 'Mary-Jane O’Connor', role: 'student', skillsToTeach: ['Programming'], rating: 5 };
  const sessions = [
    { _id: 'next', learner: user, tutor: peer, subject: 'Programming', status: 'scheduled', scheduledAt: '2026-10-10T08:00:00Z', creditAmount: 50 },
    { _id: 'incoming', learner: peer, tutor: user, subject: 'Databases', status: 'pending', creditAmount: 50 },
  ];
  const data = String(url).includes('unread-count') ? { count: 0 }
    : established && url === '/api/sessions' ? sessions
      : established && String(url).includes('/api/users/tutors') ? [peer]
        : established && url === '/api/learning/topics' ? [{ id: 'topic', name: 'Programming Fundamentals', description: 'An approved topic.' }] : [];
  return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const root = createRoot(document.getElementById('root'));
let key = 0;
const render = (path, actor = user) => root.render(<AuthContext.Provider value={{ user: actor, credits: 100, loading: false, isAuthenticated: true, refreshUser: async () => {}, logout: () => {} }}>
  <ToastProvider><ConfirmProvider><MemoryRouter key={++key} initialEntries={[path]}><Routes>
    <Route element={<AppLayout allowedRoles={['student']} />}>
      <Route path="/dashboard" element={<DashboardPage />} /><Route path="/learning" element={<LearningPage />} />
      <Route path="/sessions" element={<SessionsPage />} /><Route path="/profile" element={<ProfilePage />} />
    </Route>
    <Route path="/admin" element={<StaffLayout area="admin" />}><Route index element={<Decision />} /></Route>
  </Routes></MemoryRouter></ConfirmProvider></ToastProvider>
</AuthContext.Provider>);
// This fixture is an executable test page, not a Fast Refresh component module.
// oxlint-disable-next-line react/only-export-components
function Decision() {
  const confirm = useConfirm();
  return <button className="btn btn-danger" onClick={async () => { if (await confirm('Cancel this Session?', { title: 'Cancel Session', label: 'Cancel Session' })) writes++; }}>Risky action</button>;
}
const visible = (selector) => [...document.querySelectorAll(selector)].filter((el) => el.getClientRects().length);
try {
  render('/dashboard');
  await until(() => document.querySelector('.home-path'), 'Home failed to load');
  assert(visible('.home-path').length === 3, 'New Student needs three clear paths');
  assert(!document.querySelector('#next-session-heading'), 'Empty session section should be omitted');
  assert(document.documentElement.scrollWidth <= innerWidth, 'Home overflow');
  const mobile = innerWidth <= 1024;
  assert(visible('.student-sidebar').length === (mobile ? 0 : 1), 'Sidebar breakpoint');
  assert(visible('.student-mobile-bottom').length === (mobile ? 1 : 0), 'Mobile primary nav');
  if (mobile) {
    document.querySelector('.student-more-trigger').click();
    await until(() => document.querySelector('[role="dialog"]'), 'More dialog missing');
    assert(document.querySelector('[role="dialog"]').contains(document.activeElement), 'More dialog focus');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await until(() => !document.querySelector('[role="dialog"]'), 'Escape failed');
  } else {
    const sidebar = document.querySelector('.student-sidebar');
    assert(sidebar.scrollHeight <= sidebar.clientHeight, 'Desktop sidebar needs scrolling');
    assert(document.querySelector('a[aria-current="page"]').textContent.includes('Home'), 'Active Home missing');
  }
  render('/learning'); await until(() => document.body.textContent.includes('No learning topics are available'), 'Learning empty state');
  assert(!document.querySelector('#learning-topic'), 'Impossible required selector still exists');
  assert(document.querySelector('a[href="/tutors"]'), 'Empty learning needs next action');
  render('/sessions?view=messages'); await until(() => document.querySelector('h1')?.textContent === 'Messages', 'Messages view');
  render('/admin', { ...user, role: 'admin' }); await until(() => document.querySelector('.staff-workspace'), 'Admin shell');
  assert(!visible('.staff-nav a').some((link) => link.textContent === 'Find Tutors'), 'Staff sees irrelevant Student navigation');
  document.querySelector('.staff-content button').focus(); document.querySelector('.staff-content button').click();
  await until(() => document.querySelector('[role="dialog"]'), 'Confirmation missing');
  assert(writes === 0, 'Mutation happened before decision');
  assert(document.querySelector('[role="dialog"]').contains(document.activeElement), 'Confirmation focus missing');
  const buttons = [...document.querySelectorAll('.modal-footer button')];
  buttons.at(-1).focus(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  assert(document.activeElement === document.querySelector('.modal-close'), 'Dialog Tab did not wrap');
  buttons[0].click(); await until(() => !document.querySelector('[role="dialog"]'), 'Cancel did not close');
  assert(writes === 0, 'Cancelled decision wrote data');
  assert(document.activeElement === document.querySelector('.staff-content button'), 'Focus not restored');
  established = true;
  render('/dashboard');
  await until(() => document.querySelector('#next-session-heading'), 'Established next Session missing');
  assert(document.querySelector('#teaching-heading'), 'Incoming teaching requests missing');
  assert(document.querySelector('#featured-learning-heading'), 'Approved topics missing');
  assert(document.documentElement.scrollWidth <= innerWidth, 'Established Home overflow');
  established = false;
  render('/dashboard'); await until(() => document.querySelector('.home-path'), 'Final Home render');
  await pause();
  document.getElementById('result').textContent = `PASS: P7.1A ${innerWidth}px — navigation, Home hierarchy, learning prerequisites, Messages view, staff isolation, dialog focus/Tab/Cancel; no DB writes`;
} catch (error) { document.getElementById('result').textContent = `FAIL: ${error.message}`; }
