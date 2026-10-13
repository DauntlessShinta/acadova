import test from 'node:test';
import assert from 'node:assert/strict';
import { apiUrl } from '../src/utils/apiUrl.js';
import { dailyActivity, recentRange, rangeError } from '../src/utils/analyticsPresentation.js';
test('API origins with trailing slashes retain the exact registered endpoint', () => {
  assert.equal(apiUrl(' https://api.example.test/// ', '/api/study-sets'), 'https://api.example.test/api/study-sets');
  assert.equal(apiUrl('', 'api/study-sets'), '/api/study-sets');
  assert.equal(apiUrl('https://api.example.test', '/api/analytics/learning?from=2026-10-01'), 'https://api.example.test/api/analytics/learning?from=2026-10-01');
});
test('inclusive UTC periods handle leap days and reject invalid or excessive ranges', () => {
  assert.deepEqual(recentRange(7, new Date('2026-10-12T23:59:59Z')), { from: '2026-10-06', to: '2026-10-12' });
  assert.equal(rangeError({ from: '2024-02-29', to: '2024-02-29' }), '');
  for (const range of [{ from: '2026-02-29', to: '2026-03-01' }, { from: '2026-10-02', to: '2026-10-01' }, { from: '2024-01-01', to: '2025-01-01' }]) assert.ok(rangeError(range));
});
test('chart dates preserve separate request and settlement events and zero-fill gaps', () => {
  assert.deepEqual(dailyActivity([{ _id: '2024-02-28', count: 2 }], [{ _id: '2024-03-01', count: 1 }], { from: '2024-02-28', to: '2024-03-01' }), [
    { date: '2024-02-28', requests: 2, payments: 0 }, { date: '2024-02-29', requests: 0, payments: 0 }, { date: '2024-03-01', requests: 0, payments: 1 },
  ]);
  assert.equal(dailyActivity([], [], { from: '2024-01-01', to: '2024-12-31' }).length, 366);
});
