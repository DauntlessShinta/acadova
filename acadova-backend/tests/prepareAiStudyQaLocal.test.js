const test = require('node:test'); const assert = require('node:assert/strict'); const { randomBytes } = require('node:crypto');
const { main, assertQaUri, QA_URI } = require('../scripts/prepareAiStudyQaLocal.cjs');
const password = () => 'Qa!' + randomBytes(12).toString('hex') + 'Z';
test('QA preparation rejects nonlocal, SRV, other databases, ports, hosts and credentials before connecting', async () => {
  assert.doesNotThrow(() => assertQaUri(QA_URI));
  for (const uri of ['mongodb+srv://example.test/acadova', 'mongodb://example.test:27031/acadova?replicaSet=acadovaAiQA', 'mongodb://127.0.0.1:27017/acadova', QA_URI.replace('/acadova?', '/production?'), QA_URI.replace('127.0.0.1', '127.0.0.1,example.test'), QA_URI.replace('127.0.0.1', 'user:credential@127.0.0.1')]) {
    let connections = 0; const logs = [];
    const code = await main({ uri, argv: ['--prepare-synthetic'], env: { NODE_ENV: 'test', ACADOVA_AI_QA_PASSWORD: password() }, connect: async () => { connections++; }, log: { log: value => logs.push(value), error: value => logs.push(value) } });
    assert.equal(code, 1); assert.equal(connections, 0); assert.ok(logs.every(line => !line.includes(uri)));
  }
});
test('QA preparation requires explicit flag, safe password and non-production mode', async () => {
  for (const options of [
    { argv: [], env: { ACADOVA_AI_QA_PASSWORD: password() } },
    { argv: ['--prepare-synthetic', '--unknown'], env: { ACADOVA_AI_QA_PASSWORD: password() } },
    { argv: ['--prepare-synthetic'], env: { NODE_ENV: 'production', ACADOVA_AI_QA_PASSWORD: password() } },
    { argv: ['--prepare-synthetic'], env: { ACADOVA_AI_QA_PASSWORD: 'short' } },
    { argv: ['--prepare-synthetic'], env: { ACADOVA_AI_QA_PASSWORD: 'Q!1' + 'é'.repeat(36) } },
  ]) {
    let connections = 0;
    assert.equal(await main({ ...options, connect: async () => { connections++; }, log: { log() {}, error() {} } }), 1);
    assert.equal(connections, 0);
  }
});
test('QA setup errors never print supplied credentials, hashes or raw database errors', async () => {
  const secret = password(); const hash = await require('bcryptjs').hash(secret, 10); const logs = [];
  const code = await main({ argv: ['--prepare-synthetic'], env: { NODE_ENV: 'test', ACADOVA_AI_QA_PASSWORD: secret },
    connect: async () => { throw new Error(secret + ' ' + hash); }, log: { log: value => logs.push(value), error: value => logs.push(value) } });
  assert.equal(code, 1); assert.ok(logs.length > 0); assert.ok(logs.every(line => !line.includes(secret) && !line.includes(hash)));
});
