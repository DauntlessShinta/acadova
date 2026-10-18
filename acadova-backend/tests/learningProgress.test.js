const test = require('node:test');
const assert = require('node:assert/strict');
const { summarize } = require('../services/learningProgressService');
test('progress uses exact counts, avoids zero denominators and never rounds unfinished curriculum to 100%', () => {
  assert.deepEqual(summarize(2, 4), { completedRequirements: 2, totalRequirements: 4, percent: 50, complete: false });
  assert.equal(summarize(4, 4).percent, 100);
  assert.equal(summarize(4, 4).complete, true);
  assert.equal(summarize(0, 0).percent, null);
  assert.equal(summarize(0, 0).complete, false);
  assert.equal(summarize(999, 1000).percent, 99);
  assert.equal(summarize(999, 1000).complete, false);
});
