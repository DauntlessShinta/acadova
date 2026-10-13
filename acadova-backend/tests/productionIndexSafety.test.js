const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

// Fresh processes avoid cached models hiding a NODE_ENV-dependent schema option.
// No database connection or index operation is performed.
const inspect = (mode) => JSON.parse(execFileSync(process.execPath, ['-e', `
  const fs = require('node:fs');
  const mongoose = require('mongoose');
  const models = fs.readdirSync('./models').filter(name => name.endsWith('.js')).map(name => {
    const model = require('./models/' + name);
    const indexes = model.schema.indexes().map(([keys, options]) => {
      const declaredOptions = { ...options };
      // Mongoose annotates field indexes with the mode-specific internal flag.
      delete declaredOptions._autoIndex;
      return [keys, declaredOptions];
    });
    return { name: model.modelName, autoIndex: model.schema.options.autoIndex, indexes };
  });
  process.stdout.write(JSON.stringify({ connected: mongoose.connection.readyState, models }));
`], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, NODE_ENV: mode }, encoding: 'utf8' }));

test('production disables automatic index creation for every application model without connecting', () => {
  const result = inspect('production');
  assert.equal(result.connected, 0);
  assert.ok(result.models.length >= 18);
  for (const model of result.models) assert.equal(model.autoIndex, false, model.name);
});

test('Session and Rating retain local indexing and identical production index definitions', () => {
  const production = inspect('production');
  for (const mode of ['development', 'test', '']) {
    const local = inspect(mode);
    assert.equal(local.connected, 0);
    for (const name of ['Session', 'Rating']) {
      const model = local.models.find(item => item.name === name);
      assert.equal(model.autoIndex, true, `${name} in ${mode || 'unset mode'}`);
      assert.deepEqual(model.indexes, production.models.find(item => item.name === name).indexes);
    }
  }
  assert.deepEqual(production.models.find(item => item.name === 'Session').indexes.map(([keys]) => keys),
    [{ learner: 1 }, { tutor: 1 }, { subject: 1 }]);
  assert.deepEqual(production.models.find(item => item.name === 'Rating').indexes,
    [[{ isHidden: 1 }, {}], [{ session: 1, fromUser: 1 }, { unique: true }]]);
});
