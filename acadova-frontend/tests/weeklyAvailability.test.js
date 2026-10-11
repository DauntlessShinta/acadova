import test from 'node:test';
import assert from 'node:assert/strict';
import { availabilityComparison } from '../src/utils/weeklyAvailability.js';
import { toSessionInstant } from '../src/utils/sessionPresentation.js';
test('availability compares actual instants in tutor timezone across DST, with exclusive end and missing distinction', () => {
  const availability = { timezone: 'America/New_York', ranges: [{ day: 0, start: '01:00', end: '03:00' }] };
  assert.equal(availabilityComparison(availability, '2026-03-08T06:30:00Z').state, 'inside');
  assert.equal(availabilityComparison(availability, '2026-03-08T07:00:00Z').state, 'outside');
  assert.equal(availabilityComparison(availability, '2026-11-01T05:30:00Z').state, 'inside');
  assert.equal(availabilityComparison(availability, '2026-11-01T06:30:00Z').state, 'inside');
  assert.equal(availabilityComparison(null, '2026-03-08T06:30:00Z').state, 'missing');
  assert.equal(availabilityComparison({ timezone: 'UTC', ranges: [] }, '2026-03-08T06:30:00Z').state, 'outside');
  assert.match(availabilityComparison(availability, '2026-03-08T07:00:00Z').message, /may still request/);
});
test('native local dates reject DST gaps and invalid calendar dates, and expose the selected repeated-hour instant', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    assert.throws(() => toSessionInstant('2026-03-08T02:30'), /does not exist/);
    assert.throws(() => toSessionInstant('2026-02-30T12:00'), /does not exist/);
    assert.equal(toSessionInstant('2026-11-01T01:30'), '2026-11-01T05:30:00.000Z');
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
