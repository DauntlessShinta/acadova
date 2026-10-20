// Render the actual JSX with only auth/API boundaries injected. No browser/DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';
const backend = createRequire(new URL('../../acadova-backend/package.json', import.meta.url));
const { levelFor } = backend('./services/growthPresentation');
const source = fs.readFileSync(new URL('../src/components/student/HeaderGrowth.jsx', import.meta.url), 'utf8')
  .replace(/^import .*;\r?$/gm, '').replace('export default function HeaderGrowth', 'function HeaderGrowth');
const { code } = await transformWithOxc(source, 'HeaderGrowth.jsx', { jsx: { runtime: 'classic' } });
function render(user, state, compact = false) {
  const enabled = [];
  const context = vm.createContext({ React, useId: React.useId, useState: React.useState,
    useAuth: () => ({ user }), useGrowth: value => { enabled.push(value); return state; },
    Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children),
    RankBadge: ({ level }) => React.createElement('svg', { 'data-academic-rank': level }) });
  vm.runInContext(code + '\nglobalThis.subject=HeaderGrowth;', context);
  return { html: renderToStaticMarkup(React.createElement(context.subject, { compact })), enabled };
}
const activeUser = { role: 'student', experience: { expActive: true } };
const active = total => ({ data: { active: true, totalExp: total, rank: levelFor(total) }, error: '' });
test('actual normal inactive receipt reproduces the missing header and disables the hook', () => {
  const result = render({ role: 'student', experience: { freeLearning: false, expActive: false, version: 'legacy-credits' } }, { data: null, error: '' });
  assert.equal(result.html, ''); assert.deepEqual(result.enabled, [false]);
});
test('missing capability and non-Student roles never borrow fixture EXP', () => {
  for (const user of [{ role: 'student' }, { role: 'admin', experience: { expActive: true } }, { role: 'moderator', experience: { expActive: true } }]) assert.equal(render(user, active(120)).html, '');
});
test('API inactive response also hides the badge despite a stale active profile', () => {
  assert.equal(render(activeUser, { data: { active: false, totalExp: null }, error: '' }).html, '');
});
test('active loading and errors have actionable content rather than a fabricated rank', () => {
  assert.match(render(activeUser, { data: null, error: '' }).html, /Loading/);
  const html = render(activeUser, { data: null, error: 'temporarily unavailable' }).html;
  assert.match(html, /Retry/); assert.match(html, /href="\/growth"/); assert.doesNotMatch(html, /120|data-academic-rank/);
});
test('empty active ledger displays genuine zero with level one, progress and accessible details', () => {
  const html = render(activeUser, active(0)).html;
  assert.match(html, /data-academic-rank="1"/); assert.match(html, /Lv\. 1/); assert.match(html, /0 EXP/);
  assert.match(html, /value="0"/); assert.match(html, /aria-describedby=/); assert.match(html, /role="tooltip"/);
});
test('active desktop uses server totals and source-owned rank thresholds', () => {
  const html = render(activeUser, active(20)).html;
  assert.match(html, /20 EXP/); assert.match(html, /80 EXP to next level/); assert.match(html, /value="0.2"/);
  assert.match(html, /My Growth - Level 1/); assert.doesNotMatch(html, /120 EXP/);
});
test('compact header retains the emblem, level, real progress and My Growth link', () => {
  const html = render(activeUser, active(20), true).html;
  assert.match(html, /is-compact/); assert.match(html, />L1</); assert.match(html, /20 EXP/); assert.match(html, /aria-label="EXP progress"/);
});
test('disabled actual useGrowth effect makes no Growth API request', () => {
  const source = fs.readFileSync(new URL('../src/utils/useGrowth.js', import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '').replace('export function useGrowth', 'function useGrowth');
  let calls = 0;
  const context = vm.createContext({ useAuth: () => ({ user: { id: 'synthetic-only', role: 'student' } }), useLocation: () => ({ pathname: '/dashboard' }), useCallback: fn => fn, useState: value => [value, () => {}], useEffect: fn => fn(), api: { get: () => { calls += 1; throw new Error('Unexpected request'); } } });
  vm.runInContext(source + '\nuseGrowth(false);', context); assert.equal(calls, 0);
});
test('inactive real backend summary returns null totals without reading ledgers or users', async t => {
  const policy = backend('./config/studentExperience'); assert.equal(policy.active(), false);
  const Ledger = backend('./models/ExpLedgerEntry'), User = backend('./models/User');
  t.mock.method(Ledger, 'aggregate', () => { throw new Error('Inactive ledger read'); });
  t.mock.method(User, 'findById', () => { throw new Error('Inactive account read'); });
  const result = await backend('./services/growthPresentation').summary('not-an-object-id');
  assert.equal(result.active, false); assert.equal(result.expActive, false); assert.equal(result.totalExp, null); assert.match(result.message, /not active/);
});
test('preview proxy is opt-in and preserves the existing manual QA configuration', () => {
  const source = fs.readFileSync(new URL('../vite.bundle-c-qa.config.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?$/gm, '').replace('export default defineConfig', 'globalThis.config=defineConfig');
  for (const preview of [false, true]) {
    const context = vm.createContext({ process: { env: { ACADOVA_GROWTH_HEADER_PREVIEW: preview ? '1' : '' } }, defineConfig: value => value, react: () => ({}), tmpdir: () => 'synthetic-temp' });
    vm.runInContext(source, context);
    assert.equal(context.config.server.host, '127.0.0.1');
    assert.equal(context.config.server.port, preview ? 5176 : 5174);
    assert.equal(context.config.server.proxy['/api'].target, preview ? 'http://127.0.0.1:5004' : 'http://127.0.0.1:5002');
    assert.equal(context.config.envDir, 'synthetic-temp');
  }
});
test('preview environment flag cannot enable the normal economy', () => {
  const previous = process.env.ACADOVA_GROWTH_HEADER_PREVIEW;
  try { process.env.ACADOVA_GROWTH_HEADER_PREVIEW = '1'; assert.equal(backend('./config/studentExperience').active(), false); }
  finally { if (previous === undefined) delete process.env.ACADOVA_GROWTH_HEADER_PREVIEW; else process.env.ACADOVA_GROWTH_HEADER_PREVIEW = previous; }
});
