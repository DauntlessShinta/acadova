const test = require('node:test'); const assert = require('node:assert/strict');
const mongoose = require('mongoose'); const express = require('express'); const jwt = require('jsonwebtoken');
const User = require('../models/User'); const Plan = require('../models/StudyPlanItem'); const models = require('../models/academic');
const StudySet = require('../models/StudySet'); const Attempt = require('../models/StudyAttempt');
test('Study plans: private CRUD, term selection, parent isolation, deterministic suggestions and opt out', { skip: process.env.ACADOVA_BUNDLE_B_DB_TESTS !== '1' }, async t => {
  assert.notEqual(process.env.NODE_ENV, 'production'); const database = `acadova_bundle_b_plan_test_${process.pid}`;
  const secret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'bundle-b-plans-synthetic-only';
  await mongoose.connect(`mongodb://127.0.0.1:27031/${database}?replicaSet=acadovaAiQA`, { serverSelectionTimeoutMS: 10000 });
  assert.equal((await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'acadovaAiQA');
  await Promise.all([User, Plan, StudySet, Attempt, ...Object.values(models)].map(model => model.init()));
  t.after(async () => { assert.equal(mongoose.connection.name, database); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret; });
  const [alice, bob] = await User.create(['Alice', 'Bob'].map(name => ({ name, email: name + '@example.test', password: 'synthetic', emailVerified: true, credits: 100 })));
  const term = await models.AcademicTerm.create({ owner: alice._id, startYear: 2026, endYear: 2027, semester: 'First' }); const oldTerm = await models.AcademicTerm.create({ owner: alice._id, startYear: 2025, endYear: 2026, semester: 'Old' });
  const subject = await models.PersonalSubject.create({ owner: alice._id, termId: term._id, name: 'Current subject' }); const oldSubject = await models.PersonalSubject.create({ owner: alice._id, termId: oldTerm._id, name: 'Old subject' });
  const module = await models.PersonalModule.create({ owner: alice._id, subjectId: subject._id, title: 'Unreviewed module' });
  const wrongModule = await models.PersonalModule.create({ owner: alice._id, subjectId: oldSubject._id, title: 'Another subject module' });
  await User.updateOne({ _id: alice._id }, { $set: { currentTermId: term._id } });
  const app = express(); app.use(express.json()); app.use('/api/academic', require('../routes/academicWorkspaceRoutes')); app.use(require('../middleware/validation').validationErrorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}/api/academic`;
  const call = async (path = '/plans', method = 'GET', body, actor = alice) => { const result = await fetch(root + path, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt.sign({ id: String(actor._id) }, process.env.JWT_SECRET)}` }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); return { status: result.status, body: await result.json() }; };
  const examBody = { subjectId: String(subject._id), moduleId: String(module._id), kind: 'exam', title: 'Entered examination', timezone: 'Asia/Manila', dueAt: '2026-10-20T09:00:00+08:00', notes: 'My private plan notes' };
  let exam;
  await t.test('private exam/task creation, optional date and no fabricated schedule', async () => {
    const created = await call('/plans', 'POST', examBody); assert.equal(created.status, 201, JSON.stringify(created)); exam = created.body.data; assert.equal(exam.dueAt, '2026-10-20T01:00:00.000Z');
    const task = await call('/plans', 'POST', { subjectId: String(subject._id), kind: 'task', title: 'Read module', timezone: 'Asia/Manila' }); assert.equal(task.status, 201); assert.equal(task.body.data.dueAt, null);
    assert.equal((await call()).body.data.items.length, 2); assert.equal((await call('/plans', 'GET', undefined, bob)).body.data.items.length, 0);
  });
  await t.test('direct-ID and cross-parent access is rejected before changes', async () => {
    assert.equal((await call('/plans?subjectId=' + subject._id, 'GET', undefined, bob)).status, 404);
    assert.equal((await call('/plans/' + exam.id, 'PATCH', { title: 'Stolen', version: exam.version }, bob)).status, 404);
    assert.equal((await call('/plans/' + exam.id, 'DELETE', { version: exam.version }, bob)).status, 404);
    assert.equal((await call('/plans', 'POST', examBody, bob)).status, 404);
    assert.equal((await call('/plans', 'POST', { ...examBody, moduleId: String(wrongModule._id) })).status, 400);
    assert.equal((await call('/plans', 'POST', { ...examBody, dueAt: '2026-10-20T09:00' })).status, 400);
  });
  await t.test('rescheduling/completion uses versions, preserves timestamps, and never marks modules complete', async () => {
    let result = await call('/plans/' + exam.id, 'PATCH', { dueAt: '2026-10-21T10:00:00+08:00', version: exam.version }); assert.equal(result.status, 200); exam = result.body.data;
    assert.equal(exam.dueAt, '2026-10-21T02:00:00.000Z');
    assert.equal((await call('/plans/' + exam.id, 'PATCH', { completed: true, version: 1 })).status, 409);
    result = await call('/plans/' + exam.id, 'PATCH', { completed: true, version: exam.version }); assert.equal(result.status, 200); exam = result.body.data; assert.ok(exam.completedAt);
    assert.equal((await models.PersonalModule.findById(module._id)).status, 'not_started');
    assert.equal((await call('/modules/' + module._id, 'DELETE', {})).status, 409);
  });
  await t.test('term switching hides old-term plans without rewriting them', async () => {
    assert.equal((await call('/current-term', 'PATCH', { currentTermId: String(oldTerm._id) })).status, 200);
    assert.equal((await call()).body.data.items.length, 0); assert.equal(await Plan.countDocuments({ owner: alice._id }), 2);
    assert.equal((await call('/plans?subjectId=' + subject._id)).body.data.items.length, 2);
    await call('/current-term', 'PATCH', { currentTermId: String(term._id) });
  });
  await t.test('actual suggestions can be dismissed or globally disabled without touching another user', async () => {
    let state = (await call()).body.data; const nudge = state.nudges.find(row => row.kind === 'unreviewed'); assert.ok(nudge);
    assert.equal((await call('/plans/nudges/dismiss', 'POST', { key: nudge.key }, bob)).status, 404);
    assert.equal((await call('/plans/nudges/dismiss', 'POST', { key: nudge.key })).status, 200);
    assert.ok(!(await call()).body.data.nudges.some(row => row.key === nudge.key));
    assert.equal((await call('/plans/preferences', 'PATCH', { enabled: false })).status, 200);
    state = (await call()).body.data; assert.equal(state.nudgesEnabled, false); assert.deepEqual(state.nudges, []);
    assert.equal((await call('/plans', 'GET', undefined, bob)).body.data.nudgesEnabled, true);
    assert.equal((await User.findById(alice._id)).credits, 100);
    assert.equal((await call('/plans/' + exam.id, 'DELETE', { version: exam.version })).status, 200);
  });
});
