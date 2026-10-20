// Actual React/router; synthetic HTTP only. Never contacts a provider or database.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import '../src/index.css';

const actor = { _id:'507f1f77bcf86cd799439011', name:'Synthetic QA Student', role:'student', email:'qa@example.test', emailVerified:true, credits:100, onboardingFinishedAt:'2026-10-01', skillsToLearn:[], skillsToTeach:[] };
const first = '507f1f77bcf86cd799439021', second = '507f1f77bcf86cd799439022';
const records = [
  { id:first, title:'Network Security - Module M10', subject:'ITE 383', description:'Synthetic review of switching, network access and security mechanisms.', origin:'ai', state:'private', visibility:'private', version:1, flashcards:[{front:'Synthetic card',back:'Synthetic answer'}], questions:[{prompt:'Synthetic question',options:['A','B'],correctIndex:0}], updatedAt:'2026-10-18T02:00:00Z' },
  { id:second, title:'Database Fundamentals - Final Review', subject:'ITE 359', description:'Authored practice questions for your next review session.', origin:'manual', state:'private', visibility:'private', version:1, flashcards:[], questions:[{prompt:'Synthetic question',options:['A','B'],correctIndex:0}], updatedAt:'2026-10-17T02:00:00Z' },
];
let mode='normal', reads=0, writes=0, bridge;
const requests=[];
const reply=(data,status=200,message)=>new Response(JSON.stringify({success:status===200,data,message}),{status});
window.fetch=async(url, options={})=>{
  const path=new URL(String(url),location.origin).pathname; requests.push(path);
  if(options.method && options.method!=='GET') { writes++; throw Error('This fixture must not write.'); }
  if(path==='/api/users/me')return reply(actor);
  if(path.startsWith('/api/notifications'))return reply([]);
  if(path==='/api/study-sets'){reads++;return mode==='error'?reply(null,503,'Synthetic library unavailable. Retry loading.'):reply(mode==='empty'?[]:records);}
  if(path==='/api/study-sets/shared')return reply([{...records[1], state:'published',authorName:'Synthetic classmate',visibility:'public'}]);
  if(path==='/api/study-sets/results')return reply([{id:'attempt',studySetId:second,title:'Database Fundamentals',score:100,revision:2,submittedAt:'2026-10-18T02:00:00Z'}]);
  if(path==='/api/learning/topics')return reply([]);
  if(path==='/api/growth')return reply({active:false,totalExp:null,events:[]});
  if(path==='/api/moderator/analytics')return reply({queue:[],aging:[],outcomes:[],trend:[],pendingQueue:0,reviewDecisions:0,approvalRate:null,reportsCreated:0,sessionIssues:0});
  if(path==='/api/moderator/overview')return reply({counts:{pendingReviews:0,pendingStudySets:0,pendingResources:0,reportedContent:0,sessionDisputes:0,decisionsToday:0},queue:[],recent:[],trend:[]});
  if(path==='/api/admin/users')return reply([]);
  throw Error('Unexpected request: '+path);
};
export function Bridge(){const auth=useAuth(),navigate=useNavigate();useEffect(()=>{bridge={auth,navigate};},[auth,navigate]);return null;}
const pause=(ms=80)=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(value,message)=>{if(!value)throw Error(message);};
async function until(check,message){for(let i=0;i<120;i++){if(check())return;await pause();}throw Error(message);}
const visible=selector=>[...document.querySelectorAll(selector)].filter(el=>el.getClientRects().length);
const textButton=value=>visible('button').find(el=>el.textContent.includes(value));
async function key(value){window.__acadovaKey=value;await until(()=>!window.__acadovaKey,'Native key '+value);await pause();}
async function capture(name){if(document.activeElement?.matches('h1'))document.activeElement.blur();window.scrollTo({top:0,behavior:'instant'});await pause(250);assert(document.documentElement.scrollWidth<=innerWidth,'No horizontal overflow: '+name);assert(visualViewport.scale===1&&devicePixelRatio===1,'100% zoom');window.__acadovaCaptureDetails={name,width:innerWidth,height:innerHeight,scale:visualViewport.scale};if(window.__acadovaCaptureEnabled){window.__acadovaCapture=name;await until(()=>!window.__acadovaCapture,'Screenshot '+name);}}
const fill=(el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};
async function go(path){bridge.navigate(path);await pause(250);}
const before=new URLSearchParams(location.search).get('capture')==='/before';
localStorage.setItem('acadova_token','synthetic-consistency-only');localStorage.setItem('acadova_sidebar_collapsed','0');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><Bridge/><App/></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);
try{
 await until(()=>bridge?.auth.isAuthenticated,'Student auth');await go('/study-sets');await until(()=>document.querySelectorAll('.study-card').length===2,'Two actual returned records');
 await capture(before?'study-before':'study-expanded');
 if(!before){
  assert(document.querySelector('.student-v2 .ac-study-sets .ac-hero'),'Shared modern shell and hero');
  assert(!document.querySelector('.ac-learning-destinations')&&!document.querySelector('.learning-section-nav'),'No duplicate Learning row on Study Sets');await go('/learning');await until(()=>document.querySelectorAll('.learning-section-nav a').length===5,'All five root destinations retained');assert(document.querySelector('.learning-section-nav [aria-current=page]').textContent==='Browse learning','Root active state');await go('/study-sets');await until(()=>document.querySelectorAll('.study-card').length===2,'Return to library');
  assert(document.querySelector('.study-card').textContent.includes('Flashcards (1)'),'Actual flashcard count');
  assert(!document.querySelector('.study-card').textContent.includes('Saved to module'),'No invented module relationship');
  assert(document.querySelector(`.study-card a[href="/learning/ai-study/${first}"]`),'AI materials route retained');
  const search=document.querySelector('input[placeholder="Search my study sets..."]');fill(search,'database');await until(()=>document.querySelectorAll('.study-card').length===1,'Local title filtering');fill(search,'no matching title');await until(()=>document.querySelector('.ac-study-empty'),'Search empty state');fill(search,'');await until(()=>document.querySelectorAll('.study-card').length===2,'Clear search');
  const sort=document.querySelector('.ac-study-sort select');sort.value='title';sort.dispatchEvent(new Event('change',{bubbles:true}));await until(()=>document.querySelector('.study-card h3').textContent.startsWith('Database'),'Title sorting');sort.value='updated';sort.dispatchEvent(new Event('change',{bubbles:true}));await pause();
  const requestCount=requests.length;
  if(innerWidth>1024){
   const rail=document.querySelector('.student-sidebar'), footer=rail.querySelector('.acadi-sidebar-footer');
   assert(rail.getBoundingClientRect().width===256,'Approved 256px sidebar');
   assert(rail.querySelector('.ac-navigation-content').getBoundingClientRect().bottom<=footer.getBoundingClientRect().top,'Nav scroll region above fixed footer');
   assert(footer.getBoundingClientRect().bottom<=innerHeight,'Acadi anchored inside viewport');
   rail.querySelector('.ac-sidebar-toggle').click();await pause(300);assert(rail.getBoundingClientRect().width===76,'76px physical rail');
   const launch=rail.querySelector('.acadi-sidebar-launch');assert(launch.getBoundingClientRect().right<=76&&launch.getBoundingClientRect().width>=44,'Collapsed launcher fits rail and touch target');
   launch.focus();await until(()=>document.querySelector('[role=tooltip]'),'Acadi keyboard tooltip');await capture('study-collapsed');await key('Enter');
  }else{
   assert(document.querySelector('.student-mobile-bottom').getBoundingClientRect().height>0,'Mobile primary nav visible');
   document.querySelector('[aria-label="More navigation"]').focus();await key('Enter');await until(()=>textButton('Ask Acadi'),'Acadi mobile More entry');textButton('Ask Acadi').click();
  }
  await until(()=>document.querySelector('.acadi-help'),'Acadi opens');assert(requests.length===requestCount,'Opening Acadi sends no request');
  assert(document.querySelector('.acadi-help').textContent.includes('does not use an AI model'),'Honest local-help capability');
  textButton('Navigation & help').click();await until(()=>document.querySelector('.acadi-help-reference'),'Separate help dialog');const details=document.querySelector('.acadi-help-faq details');details.querySelector('summary').focus();await key('Enter');assert(details.open,'Native keyboard FAQ');
  assert(requests.length===requestCount,'Opening and reading FAQ sends no request');await capture('acadi-help');await key('Escape');await until(()=>!document.querySelector('.acadi-help-reference'),'Reference closes independently');
  document.querySelector('.acadi-help .modal-close').focus();await key('Shift+Tab');assert(document.querySelector('.acadi-help').contains(document.activeElement),'Focus trapped');
  await key('Escape');await until(()=>!document.querySelector('[role=dialog]'),'Help closes');
  assert(document.activeElement.matches(innerWidth>1024?'.acadi-sidebar-launch':'[aria-label="More navigation"]'),'Focus returned to launcher; actual '+document.activeElement?.outerHTML.slice(0,180));
  const account=visible('.account-trigger')[0];account.click();await until(()=>textButton('Acadi help'),'Profile menu Acadi entry');
  assert(visible('.account-actions a').some(el=>el.getAttribute('href')==='/credits'&&el.textContent.includes('Credits & history')),'Current Credits label retained');
  assert(visible('.account-actions a').some(el=>el.getAttribute('href')==='/growth'),'Growth retained');
  assert(visible('.account-actions a').some(el=>el.getAttribute('href')==='/profile')&&visible('.account-actions a').some(el=>el.getAttribute('href')==='/settings'),'Profile and Settings unchanged');
  textButton('Acadi help').click();await until(()=>document.querySelector('.acadi-help'),'Profile launches help');await key('Escape');assert(document.activeElement===account,'Profile launch restores account trigger');
  await go('/study-sets?view=shared');await until(()=>document.querySelector('.study-card')?.textContent.includes('Synthetic classmate'),'Shared approved records retained');assert(document.querySelector('#study-search'),'Shared server search retained');await capture('study-shared');
  await go('/study-sets?view=results');await until(()=>document.querySelector('.study-card')?.textContent.includes('Score: 100%'),'Results retained');assert(document.querySelector(`.study-card a[href="/study-sets/${second}?attempt=attempt"]`),'Result attempt route preserved');
  await go('/study-sets/new');await until(()=>document.querySelector('#study-title'),'Manual editor retained');assert(document.querySelector('button[type=submit]')?.textContent==='Save private draft','Manual saving remains available');
  await go('/study-sets');await until(()=>document.querySelectorAll('.study-card').length===2,'Return from clean draft');mode='error';await go('/study-sets?check=error');await until(()=>document.querySelector('#study-error'),'Load error');assert(!document.querySelector('.study-card'),'No failed data shown as saved');mode='empty';textButton('Retry loading').click();await until(()=>document.querySelector('.ac-study-empty'),'Retry to real empty state');await capture('study-empty');mode='normal';await go('/study-sets?check=recovered');await until(()=>document.querySelectorAll('.study-card').length===2,'Library recovery');
  assert(writes===0&&reads>=4,'No study or credit mutation in visual/help workflow');
  for(const [role,path,count] of [['moderator','/moderator',3],['admin','/admin/users',8]]){
   actor.role=role;await bridge.auth.refreshUser();await until(()=>bridge.auth.user?.role===role,'Synthetic role '+role);await go(path);await until(()=>document.querySelector('.staff-workspace'),'Staff route '+role);
   assert(document.querySelectorAll('.staff-sidebar .staff-nav>a').length===count,'Approved staff groups including Analytics '+role);
   if(innerWidth<=1024){document.querySelector('[aria-label="Open staff navigation"]').click();await until(()=>document.querySelector('[role=dialog]'),'Staff mobile drawer');}
   const trigger=visible('.account-trigger')[0];trigger.click();await until(()=>visible('.account-actions').length,'Staff account menu');assert(!textButton('Acadi help'),'Student help not injected into staff menu');assert(!visible('.account-actions a').some(el=>el.getAttribute('href')==='/credits'),'No student wallet in staff menu');await key('Escape');if(document.querySelector('[role=dialog]'))await key('Escape');
  }
  actor.role='student';await bridge.auth.refreshUser();await until(()=>bridge.auth.user?.role==='student','Return to Student');await go('/study-sets');await until(()=>document.querySelectorAll('.study-card').length===2,'Final library');
 }
 document.getElementById('result').textContent=before?'PASS: before-only Study Sets screenshot; no functional verification claimed':'PASS: real UI / synthetic HTTP: Study Sets counts, sorting/search, shared/results/editor/error/retry, 256/76 rail, local Acadi FAQ with zero requests, native keyboard/focus restoration, student profile and three Moderator/eight Admin navigation groups; no writes';document.getElementById('result').hidden=true;
}catch(error){document.getElementById('result').textContent='FAIL: '+error.message;}
