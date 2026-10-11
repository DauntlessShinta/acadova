const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAvailability } = require('../utils/weeklyAvailability');
test('weekly availability validates timezone, bounds, overlap, empty guidance and clear', () => {
  assert.equal(validateAvailability(null), null);
  assert.deepEqual(validateAvailability({ timezone: 'Asia/Manila', ranges: [] }), { timezone: 'Asia/Manila', ranges: [] });
  const range = { day: 1, start: '09:00', end: '17:00' };
  for (const value of [{ timezone: 'Invalid/Zone', ranges: [] }, { timezone: 'UTC', ranges: [{ ...range, day: 7 }] },
    { timezone: 'UTC', ranges: [{ ...range, end: '08:00' }] }, { timezone: 'UTC', ranges: [range, range] },
    { timezone: 'UTC', ranges: [{ ...range, start: '9:00' }] }, { timezone: 'UTC', ranges: [], credits: 20 }]) assert.throws(() => validateAvailability(value));
  assert.equal(validateAvailability({ timezone: 'America/New_York', ranges: [range] }).ranges[0].start, '09:00');
});
