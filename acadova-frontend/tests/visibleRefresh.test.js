import test from 'node:test';
import assert from 'node:assert/strict';
import { createRefreshGate, subscribeVisibleRefresh } from '../src/utils/visibleRefresh.js';
import { notificationMessage } from '../src/utils/notificationPresentation.js';

test('dashboard requests serialize, supersede queued refreshes and reject old-filter data', async () => {
  const gate = createRefreshGate(); let finish; const applied = []; let active = 0; let maximum = 0;
  const initial = gate.run(async valid => { maximum = Math.max(maximum, ++active); await new Promise(resolve => { finish = resolve; }); if (valid()) applied.push('old'); active--; });
  gate.run(async () => applied.push('superseded'));
  gate.invalidate();
  gate.run(async valid => { maximum = Math.max(maximum, ++active); if (valid()) applied.push('new'); active--; });
  finish(); await initial; await Promise.resolve();
  assert.deepEqual(applied, ['new']); assert.equal(maximum, 1);
});

test('dashboard polling pauses while hidden and only relevant successful mutations revalidate', () => {
  const doc = new EventTarget(); doc.visibilityState = 'visible';
  const win = new EventTarget(); let tick; let cleared = 0; let refreshed = 0;
  win.setInterval = (callback, delay) => { assert.equal(delay, 45000); tick = callback; return 1; };
  win.clearInterval = () => { tick = null; cleared++; };
  const stop = subscribeVisibleRefresh(() => refreshed++, { document: doc, window: win });
  tick(); assert.equal(refreshed, 1);
  doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); assert.equal(tick, null);
  const event = path => { const e = new Event('acadova:data-changed'); e.detail = { endpoint: path }; win.dispatchEvent(e); };
  event('/api/admin/credits/adjustments'); assert.equal(refreshed, 1);
  doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange')); assert.equal(refreshed, 2);
  event('/api/notifications/read-all'); assert.equal(refreshed, 2);
  event('/api/sessions/fixture/confirm'); assert.equal(refreshed, 3);
  stop(); assert.equal(tick, null); event('/api/admin/credits/rules'); assert.equal(refreshed, 3); assert.equal(cleared, 2);
});

test('notification date formatting changes only displayed UTC instants', () => {
  const source = 'Proposed: 2026-10-12T08:00:00.000Z (UTC). Expires: 2026-10-13T08:00:00.000Z (UTC).';
  const result = notificationMessage(source);
  assert.ok(result.startsWith('Proposed: ')); assert.ok(result.includes('Expires: ')); assert.ok(!result.includes('T08:00'));
  assert.equal(notificationMessage('Your Session was accepted.'), 'Your Session was accepted.');
  assert.equal(notificationMessage('2026-02-31T08:00:00Z'), '2026-02-31T08:00:00Z');
  assert.equal(source.includes('T08:00'), true);
});
