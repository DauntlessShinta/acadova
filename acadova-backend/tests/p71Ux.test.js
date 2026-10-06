const test = require('node:test');
const assert = require('node:assert/strict');
const { schemas, validateBody } = require('../middleware/validation');
const { nameValidationMessage } = require('../utils/nameValidation');
const { checkInvocation, seedTopics } = require('../scripts/seedStarterTopics');

test('register and profile enforce the same international name contract', () => {
  assert.equal(nameValidationMessage('aaaaaa'), '', 'Syntactic validation must not guess whether a name is real');
  for (const name of ["Mary-Jane O'Connor", 'José Dela Cruz', '王小明', 'Nguyễn Thị Ánh', 'A. Rahman', 'Sukarno', 'Jose\u0301', 'Student123', 'https://example.com', 'www.example.com', 'John.. Doe', 'a'.repeat(60), ' ', 'John\nDoe']) {
    const expected = !nameValidationMessage(name);
    for (const schema of [{ name: schemas.register.name }, { name: schemas.profile.name }]) {
      let accepted = false;
      const res = { status() { return this; }, json() {} };
      validateBody(schema)({ body: { name } }, res, () => { accepted = true; });
      assert.equal(accepted, expected, name);
    }
  }
});

test('starter topic invocation refuses production, arbitrary flags, and external URI configuration', () => {
  assert.doesNotThrow(() => checkInvocation(['--local-only'], {}));
  for (const [args, env] of [[[], {}], [['--local-only', '--force'], {}], [['--local-only'], { NODE_ENV: 'production' }], [['--local-only'], { MONGO_URI: 'mongodb://external' }]]) {
    assert.throws(() => checkInvocation(args, env));
  }
});

test('starter topic seed is repeatable and preserves existing staff edits', async () => {
  const records = new Map([['web-development', { name: 'Staff edited title', status: 'archived' }]]);
  let uniqueIndex;
  const Topic = { init: async () => {}, collection: { createIndex: async (_keys, options) => { uniqueIndex = options.unique; } },
    updateOne: async ({ slug }, { $setOnInsert }, options) => { assert.equal(options.upsert, true); if (!records.has(slug)) records.set(slug, $setOnInsert); } };
  await seedTopics(Topic, 'moderator'); await seedTopics(Topic, 'moderator');
  assert.equal(uniqueIndex, true); assert.equal(records.size, 5);
  assert.deepEqual(records.get('web-development'), { name: 'Staff edited title', status: 'archived' });
  assert.equal(records.get('database-systems').status, 'draft');
});
