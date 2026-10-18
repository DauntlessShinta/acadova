const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../services/expAwardService');
const { expEnginePolicy, EXP_ACTIVE } = require('../config/growthPolicy');
const Award = require('../models/ExpAward');
const Lock = require('../models/ExpAccountLock');
test('EXP policy is bounded, configurable and fails closed without enabling awards', () => {
  assert.equal(EXP_ACTIVE, false);
  assert.equal(expEnginePolicy({}).minimumMinutes, 15);
  assert.equal(expEnginePolicy({ EXP_DAILY_AWARDS: '3' }).dailyAwards, 3);
  for (const value of ['0', '-1', '1.5', 'Infinity', '5000', '2junk', '']) {
    assert.throws(() => expEnginePolicy({ EXP_DAILY_AWARDS: value }), { code: 'EXP_POLICY_INVALID' });
  }
  assert.equal(Award.schema.options.autoCreate, false); assert.equal(Award.schema.options.autoIndex, false);
  assert.equal(Lock.schema.options.autoCreate, false);
  assert.ok(Award.schema.indexes().some(([keys, options]) => keys.owner && keys.eventKey && options.unique));
});
test('environment, client-like payloads and readiness claims cannot activate any public writer', async () => {
  const old = process.env.EXP_ACTIVE; process.env.EXP_ACTIVE = 'true';
  try {
    for (const key of ['awardAssessment', 'queueTutoring', 'finalizeTutoring', 'holdTutoring', 'releaseTutoringHold', 'reverseAward']) {
      await assert.rejects(service[key]({ role: 'admin', amount: 1000, active: true, allCreditWritersRetired: true }), { code: 'EXP_NOT_ACTIVE' });
    }
    await assert.rejects(service.createIsolatedExpEngine(), { code: 'EXP_ISOLATED_TEST_ONLY' });
  } finally { if (old === undefined) delete process.env.EXP_ACTIVE; else process.env.EXP_ACTIVE = old; }
});
test('caps use UTC calendar days and Monday weeks across year boundaries', () => {
  const sunday = service.utcWindows(new Date('2027-01-03T23:59:59Z'));
  assert.equal(sunday.day.toISOString(), '2027-01-03T00:00:00.000Z');
  assert.equal(sunday.week.toISOString(), '2026-12-28T00:00:00.000Z');
  assert.equal(service.utcWindows(new Date('2027-01-04T00:00:00Z')).week.toISOString(), '2027-01-04T00:00:00.000Z');
});
test('fresh production process cannot enable writers or the isolated capability with environment flags', () => {
  const { spawnSync } = require('node:child_process');
  const child = spawnSync(process.execPath, ['--max-old-space-size=96', '-e', `
    const service=require('./services/expAwardService');
    Promise.all([service.awardAssessment({active:true,amount:999}),service.createIsolatedExpEngine()]
      .map(action=>action.then(()=>{throw Error('Unexpected activation');},error=>error.code)))
      .then(codes=>{if(codes[0]!=='EXP_NOT_ACTIVE'||codes[1]!=='EXP_ISOLATED_TEST_ONLY')process.exitCode=1;console.log(codes.join(','));})
      .catch(()=>{process.exitCode=1;});
  `], { cwd: require('node:path').resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', EXP_ACTIVE: 'true', EXP_ENABLED: 'true', ACADOVA_EXP_ENGINE_DB_TESTS: '1' }, encoding: 'utf8', timeout: 20000, windowsHide: true });
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  assert.match(child.stdout, /EXP_NOT_ACTIVE,EXP_ISOLATED_TEST_ONLY/);
});
