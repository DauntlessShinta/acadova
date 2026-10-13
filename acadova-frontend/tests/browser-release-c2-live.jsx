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
  requests.push({ path: target.pathname, query: target.search, method: options.method || 'GET', status: response.status });
  return response;
};
let bridge;
export function Bridge() { const auth = useAuth(); const navigate = useNavigate(); const route = useLocation(); useEffect(() => { bridge = { auth, navigate, route }; }, [auth, navigate, route]); return null; }
const pause = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, label) => { if (!value) throw new Error(label); };
const until = async (check, label) => { for (let i = 0; i < 240; i++) { if (check()) return; await pause(); } throw new Error(label); };
const button = label => [...document.querySelectorAll('button')].find(el => el.getClientRects().length && el.textContent.trim() === label);
const fill = (selector, value) => { const el = document.querySelector(selector); Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); };
const go = async path => { bridge.navigate(path); await until(() => bridge.route.pathname === (path.startsWith('/admin/security') || path.startsWith('/admin/audit-logs') ? '/admin/trust-activity' : path.split('?')[0]), 'Navigation ' + path); await pause(100); };
const layout = () => assert(document.documentElement.scrollWidth <= innerWidth + 1, 'No document overflow');
const capture = async name => { if (!window.__acadovaCaptureEnabled) return; window.scrollTo(0, 0); await pause(100); window.__acadovaCapture = name; await until(() => !window.__acadovaCapture, 'Capture ' + name); };

localStorage.setItem('acadova_token',config.token);
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge/><App/></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try {
 await until(()=>bridge?.auth.user?.role==='admin','Real Admin');await go('/admin/users');await until(()=>document.querySelectorAll('.admin-user-table tbody tr').length>=5,'Real directory');assert(document.querySelectorAll('thead th').length===5,'Five columns');layout();await capture('live-c2-directory');
 const trigger=document.querySelector('.user-actions-trigger');trigger.click();await until(()=>document.querySelector('[role=dialog]'),'Real action dialog');assert(button('Promote to Moderator')||button('Return to Student'),'Existing role action retained');window.__acadovaKey='Escape';await until(()=>!document.querySelector('[role=dialog]'),'Keyboard close');assert(!requests.some(row=>row.path.endsWith('/role')),'Opening actions causes no role change');
 await bridge.auth.login(config.peerEmail,config.password);await until(()=>bridge.auth.user?.role==='student','Owner login');await go('/profile');await until(()=>document.getElementById('profile-university'),'Real optional fields');
 fill('#profile-university','Published Synthetic University');fill('#profile-bio','I enjoy explaining Java through collaborative practice.');
 const year=document.getElementById('profile-year-level');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(year,'4th year');year.dispatchEvent(new Event('change',{bubbles:true}));
 for(const input of document.querySelectorAll('.profile-visibility input'))if(!input.checked)input.click();
 button('Save Profile Changes').click();await until(()=>requests.some(row=>row.path==='/api/users/me'&&row.method==='PATCH'&&row.status===200)&&button('Save Profile Changes')?.disabled===false,'Real profile saved');
 await bridge.auth.login(config.studentEmail,config.password);await until(()=>bridge.auth.user?.role==='student'&&String(bridge.auth.user._id)===config.studentId,'Different viewer');await go('/tutors/'+config.peerId);await until(()=>document.querySelector('.public-profile-details')?.textContent.includes('Published Synthetic University'),'Shared details loaded through real API');assert(!document.querySelector('main').textContent.includes('example.test'),'No public account email');layout();await capture('live-c2-public-profile');
 button('Subjects').click();assert(document.querySelector('.public-subject-list').textContent.includes('Java'),'Real teaching subject');button('Reviews').click();await until(()=>document.querySelector('.peer-reviews').textContent.includes('Visible review'),'Real visible reviews');assert(!document.querySelector('main').textContent.includes('PRIVATE_HIDDEN_REVIEW'),'Hidden review excluded');button('Availability').click();assert(document.querySelector('#public-profile-panel-availability').textContent.includes('09:00'),'Configured availability');button('About').click();
 button('Message').click();await until(()=>document.activeElement.id==='requestMessage','No existing chat uses request message');fill('#requestMessage','Please help with Java arrays.');fill('#scheduledAt','2099-10-15T06:00');button('Send Session Request').click();await until(()=>document.querySelector('.session-request-success'),'Real protected request');assert(bridge.auth.user.credits===100,'No reward on request');
 button('Message').click();await until(()=>location.pathname.startsWith('/sessions/')&&location.hash==='#session-messages','Existing protected conversation reused');await until(()=>document.getElementById('session-messages'),'Actual chat rendered');layout();
 const denied=await window.fetch('/api/admin/users',{headers:{Authorization:'Bearer '+localStorage.getItem('acadova_token')}});assert(denied.status===403,'Database role denies Admin');
 assert(requests.filter(row=>row.status>=400).every(row=>row.path==='/api/admin/users'&&row.status===403),'No unexpected API failures: '+JSON.stringify(requests.filter(row=>row.status>=400)));
 document.getElementById('result').textContent='PASS: Real C.2 Express/MongoDB owner details, public privacy, reviews, availability, directory, pending request and protected messaging; unchanged credit balances.';
} catch(error){document.getElementById('result').textContent='FAIL: Real C.2 '+error.message+' | '+location.pathname+' | '+JSON.stringify(requests.slice(-8));}
