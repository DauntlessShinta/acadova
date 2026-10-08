// Public Landing in the real router/providers; no live API or account writes.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { ConfirmProvider } from '../src/context/ConfirmContext';
import '../src/index.css';

localStorage.removeItem('acadova_token'); localStorage.removeItem('acadova_user');
const errors = [];
const entrances = [];
document.addEventListener('animationstart', (event) => entrances.push({ element: event.target, name: event.animationName, time: performance.now() }));
window.addEventListener('error', (event) => errors.push(event.message));
window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason)));
window.fetch = async () => { throw new Error('Unexpected API request from the public Landing'); };
window.history.replaceState({}, '', '/');
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ToastProvider><ConfirmProvider><App /></ConfirmProvider></ToastProvider></AuthProvider></BrowserRouter>);

const pause = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (value, label) => { if (!value) throw new Error(label); };
const until = async (check, label) => { for (let i = 0; i < 150; i++) { if (check()) return; await pause(); } throw new Error(label); };
const key = async (value) => { window.__acadovaKey = value; await until(() => !window.__acadovaKey, 'Keyboard ' + value); await pause(); };
const capture = async (name, selector) => {
  const target = selector ? document.querySelector(selector) : null;
  window.scrollTo({ top: target ? scrollY + target.getBoundingClientRect().top - 88 : 0, behavior: 'instant' }); await pause(650);
  if (window.__acadovaCaptureEnabled) { window.__acadovaCapture = name; await until(() => !window.__acadovaCapture, 'Capture ' + name); }
};
const hover = async (element) => {
  element.scrollIntoView({ block: 'center', behavior: 'instant' }); await pause();
  const box = element.getBoundingClientRect(); window.__acadovaPointer = { x: box.x + box.width / 2, y: box.y + box.height / 2, hover: true };
  await until(() => !window.__acadovaPointer, 'Pointer hover'); await pause(220);
};
const visible = (selector) => [...document.querySelectorAll(selector)].filter((element) => element.getClientRects().length);
const layout = () => {
  assert(document.documentElement.scrollWidth <= innerWidth, 'Document overflow');
  for (const control of visible('.landing-delight a, .landing-delight button, .landing-delight select, .landing-public-navbar a, .landing-public-navbar button, .landing-public-footer a')) {
    const box = control.getBoundingClientRect();
    assert(box.left >= -1 && box.right <= innerWidth + 1, 'Control outside viewport: ' + control.textContent);
    assert(box.height >= 23.9 && box.width >= 23.9, 'Control below 24px: ' + control.textContent);
    assert(control.scrollWidth <= control.clientWidth + 1, 'Clipped control: ' + control.textContent);
    if (control.matches('.btn, .landing-skill-button, .site-menu-button, .site-nav-link, select')) assert(box.height >= 43.9, 'Important control below 44px: ' + control.textContent);
  }
  for (const element of visible('.landing-peer-photo, .landing-photo-frame, .landing-peer-visual .landing-exchange-pill')) {
    const box = element.getBoundingClientRect(); assert(box.left >= -1 && box.right <= innerWidth + 1, 'Clipped hero visual');
  }
};

try {
  await until(() => document.querySelector('.landing-peer-photo img')?.naturalWidth === 1200, 'Local WebP photograph loaded');
  await document.fonts.ready; await pause(700);
  assert(visualViewport.scale === 1 && devicePixelRatio === 1, '100% browser zoom');
  assert(document.querySelectorAll('h1').length === 1, 'One main heading');
  assert(!document.querySelector('.landing-peer-visual .landing-skill-node, .landing-motion-toggle'), 'Hero subject labels and motion control removed from DOM');
  const logoAsset = new Image(); logoAsset.src = '/images/acadova-logo-new.png'; await logoAsset.decode();
  assert(logoAsset.naturalWidth === 1448 && logoAsset.naturalHeight === 1086, 'Supplied logo decodes at its original dimensions');
  assert(document.querySelectorAll('.public-brand-logo').length === 2, 'Navbar and Footer use the supplied logo');
  for (const logo of document.querySelectorAll('.public-brand-logo')) {
    const link = logo.closest('a'); const box = logo.getBoundingClientRect();
    assert(link?.getAttribute('href') === '/' && link.getAttribute('aria-label') === 'Acadova home', 'Logo remains an accessible Home link');
    assert(logo.querySelector('image').getAttribute('href') === '/images/acadova-logo-new.png', 'Exact supplied artwork used');
    assert(logo.getAttribute('aria-hidden') === 'true' && logo.getAttribute('focusable') === 'false', 'Artwork adds no focus stop or duplicate name');
    assert(Math.abs(box.width / box.height - 1362 / 308) < .01 && box.width >= 159, 'Logo keeps proportions and readable wordmark sizing');
    assert(box.top >= link.getBoundingClientRect().top && box.bottom <= link.getBoundingClientRect().bottom + 1, 'Logo fits its Home target');
  }
  assert(document.querySelector('.site-navbar').getBoundingClientRect().height <= 73, 'Logo does not enlarge Navbar');
  const trigger = document.querySelector('.site-menu-button');
  if (trigger.getClientRects().length) assert(document.querySelector('.site-navbar .site-brand').getBoundingClientRect().right + 16 <= trigger.getBoundingClientRect().left, 'Logo clears compact menu trigger');
  const primary = document.querySelector('.landing-action-row .btn-primary');
  assert(primary.getAttribute('href') === '/register' && primary.textContent.includes('Start learning'), 'Existing CTA preserved');
  assert(document.querySelector('.landing-action-row .btn-secondary').getAttribute('href') === '#how-it-works', 'Existing secondary anchor preserved');
  assert(primary.getBoundingClientRect().bottom <= innerHeight, 'Hero primary visible in initial viewport');
  assert(document.querySelector('.landing-peer-photo img').alt.includes('peers'), 'Meaningful photo alt');
  const photo = document.querySelector('.landing-photo-frame img').getBoundingClientRect();
  assert(Math.abs(photo.width / photo.height - 1.5) < .01, 'All three collaborators retained in natural 3:2 crop');
  layout(); await capture('hero'); await capture('hero-photo', '.landing-peer-visual');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const badgeStyle = getComputedStyle(document.querySelector('.landing-badge-row'));
  assert(badgeStyle.animationName === (reduced ? 'none' : 'landing-hero-arrival'), 'Hero stagger honors reduced motion');
  const ambientStyle = getComputedStyle(document.querySelector('.landing-hero'), '::before');
  assert(ambientStyle.animationName === (reduced || innerWidth <= 780 ? 'none' : 'landing-ambient'), 'Ambient motion stops on mobile/reduced motion');
  assert(reduced || innerWidth <= 780 || (ambientStyle.animationDuration === '20s' && ambientStyle.animationPlayState === 'running'), 'Desktop ambient movement remains automatic and unchanged');
  const homeLink = document.querySelector('.site-navbar .site-brand'); homeLink.focus();
  await key('Tab'); assert(document.activeElement !== homeLink.querySelector('svg'), 'Logo artwork adds no keyboard stop');
  homeLink.focus(); await key('Enter'); assert(location.pathname === '/', 'Home logo supports keyboard activation');
  window.scrollTo({ top: 0, behavior: 'instant' }); primary.focus(); await key('Shift+Tab'); await key('Tab');
  assert(document.activeElement === primary && getComputedStyle(primary).outlineStyle === 'solid', 'Logical keyboard order and visible focus');
  await capture('focus');
  await key('Tab'); assert(document.activeElement.classList.contains('btn-secondary'), 'Secondary follows primary');
  await key('Enter'); await pause(750);
  assert(document.querySelector('#how-it-works').getBoundingClientRect().top >= 70, 'Anchor clears sticky navbar');
  await capture('workflow', '#how-it-works');
  const timeline = document.querySelector('.landing-timeline');
  assert(reduced || timeline.classList.contains('landing-is-revealed'), 'How-it-works reveals on intersection');
  assert(getComputedStyle(timeline.querySelector('.landing-step')).animationName === (reduced ? 'none' : 'landing-group-arrival'), 'Sequential workflow motion honors reduced motion');
  const stepEntrances = entrances.filter((entry) => entry.element.matches('.landing-step') && entry.name === 'landing-group-arrival');
  assert(reduced ? stepEntrances.length === 0 : stepEntrances.length === 4, 'All four steps actually enter once');
  if (!reduced) assert(stepEntrances.every((entry, index) => !index || entry.time >= stepEntrances[index - 1].time), 'Progressive step order');
  window.scrollTo({ top: 0, behavior: 'instant' }); await pause();
  timeline.scrollIntoView({ behavior: 'instant', block: 'center' }); await pause(700);
  assert(timeline.getAnimations({ subtree: true }).length === 0, 'Workflow does not replay');
  assert(entrances.filter((entry) => entry.element.matches('.landing-step')).length === stepEntrances.length, 'No second scroll entrance');
  const menu = document.querySelector('.site-menu-button');
  if (menu.getClientRects().length) {
    window.scrollTo({ top: 0, behavior: 'instant' }); menu.focus(); await key('Enter');
    await until(() => document.querySelector('#site-mobile-menu'), 'Mobile menu opens');
    assert(menu.getAttribute('aria-expanded') === 'true', 'Menu exposes state'); layout(); await capture('mobile-menu');
    document.querySelector('#site-mobile-menu a').focus(); await key('Escape');
    assert(!document.querySelector('#site-mobile-menu') && document.activeElement === menu, 'Escape closes menu and restores focus');
    await key('Enter'); await until(() => document.querySelector('#site-mobile-menu'), 'Menu reopens');
    document.querySelector('#site-mobile-menu a').focus(); await key('Enter'); assert(!document.querySelector('#site-mobile-menu'), 'Menu selection closes disclosure');
  }
  for (const [name, selector] of [['comparison','#problem'],['credits','#credit-system'],['features','#features'],['skills','#skill-network'],['dashboard','#dashboard-preview'],['community','#community'],['sdg','#sdg-section'],['cta','.landing-final-cta'],['footer','.site-footer']]) {
    await capture(name, selector); layout();
  }
  const skill = [...document.querySelectorAll('.landing-skill-button')].find((button) => button.textContent.includes('Databases'));
  skill.focus(); await key('Enter');
  assert(skill.getAttribute('aria-pressed') === 'true' && document.querySelector('.landing-skill-detail h3').textContent === 'Databases', 'Existing skill explorer responds to keyboard');
  const swap = document.querySelector('.landing-swap-button'); swap.focus(); await key('Enter');
  assert(document.querySelector('.landing-simulator').classList.contains('is-previewed'), 'Existing credit example remains interactive');
  const sessions = [...document.querySelectorAll('.landing-dashboard-nav button')].find((button) => button.textContent.includes('Sessions'));
  sessions.focus(); await key('Enter'); assert(document.querySelector('.landing-dashboard-content h3').textContent.includes('Follow each exchange'), 'Existing dashboard example works');
  await hover(primary);
  const moves = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches;
  await until(() => getComputedStyle(primary).transform === (moves ? 'matrix(1, 0, 0, 1, 0, -2)' : 'none'), 'CTA hover transition reaches its final state');
  assert(getComputedStyle(primary).transform === (moves ? 'matrix(1, 0, 0, 1, 0, -2)' : 'none'), 'Pointer-only CTA lift');
  assert(getComputedStyle(primary.querySelector('svg')).transform === (moves ? 'matrix(1, 0, 0, 1, 3, 0)' : 'none'), 'Pointer-only arrow feedback');
  await hover(document.querySelector('.landing-feature-card')); assert(getComputedStyle(document.querySelector('.landing-feature-card')).transform === 'none', 'Informational cards remain still');
  const image = document.querySelector('.landing-peer-photo img'); const imageHeight = document.querySelector('.landing-photo-frame').getBoundingClientRect().height;
  image.src = 'data:image/webp;base64,invalid'; await until(() => document.querySelector('.landing-photo-fallback'), 'Image decode failure shows fallback');
  assert(Math.abs(document.querySelector('.landing-photo-frame').getBoundingClientRect().height - imageHeight) < 1, 'Image failure preserves reserved dimensions: ' + imageHeight + ' -> ' + document.querySelector('.landing-photo-frame').getBoundingClientRect().height);
  layout(); await capture('image-fallback', '.landing-peer-visual');
  assert(errors.length === 0, 'Runtime errors: ' + errors.join('; '));
  const ctaEntrances = entrances.filter((entry) => entry.element.matches('.landing-hero-copy > .landing-action-row') && entry.name === 'landing-hero-arrival');
  assert(reduced ? ctaEntrances.length === 0 : ctaEntrances.length === 1, 'Hero CTA does not replay during interactions');
  document.getElementById('result').textContent = `PASS: ${innerWidth}x${innerHeight} Landing: supplied logo/proportions/Home/height; clean hero; image/crop/fallback; CTA/anchors; overflow/targets; keyboard/menu; examples; one-time reveals; reduced motion; automatic ambient; hover; no API calls`;
  document.getElementById('result').hidden = true;
} catch (error) { document.getElementById('result').textContent = 'FAIL: ' + error.message; }
