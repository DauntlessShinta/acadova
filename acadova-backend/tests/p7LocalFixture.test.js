const test = require('node:test');
const assert = require('node:assert/strict');
const { checkInvocation } = require('../scripts/prepareP7Local');

test('P7 operator fixture refuses production, inherited database targets and implicit writes', () => {
  assert.throws(() => checkInvocation([], {}));
  assert.throws(() => checkInvocation(['--local-only', '--unknown'], {}));
  assert.throws(() => checkInvocation(['--local-only'], { NODE_ENV: 'production' }));
  assert.throws(() => checkInvocation(['--local-only'], { NODE_ENV: 'Production' }));
  assert.throws(() => checkInvocation(['--local-only'], { MONGO_URI: 'inherited-target' }));
  assert.throws(() => checkInvocation(['--local-only', '--rotate-passwords'], {}));
  assert.doesNotThrow(() => checkInvocation(['--local-only', '--demo'], {}));
});
