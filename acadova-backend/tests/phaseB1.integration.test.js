// Synthetic data in a dedicated loopback database only; never loads dotenv.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const CreditTransaction = require('../models/CreditTransaction');
const StudySet = require('../models/StudySet');
const StudyReport = require('../models/StudyReport');
const LearningResource = require('../models/LearningResource');
const { validationErrorHandler } = require('../middleware/validation');

test('B.1 search, pagination and operational counts against isolated MongoDB', { skip: process.env.ACADOVA_PHASEB1_DB_TESTS !== '1' }, async t => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const database = `acadova_phaseb1_${process.pid}`;
  await mongoose.connect(`mongodb://127.0.0.1:27029/${database}?replicaSet=acadovaPhase1`, { serverSelectionTimeoutMS: 10000 });
  assert.equal((await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'acadovaPhase1');
  const previous = process.env.JWT_SECRET; process.env.JWT_SECRET = randomBytes(32).toString('hex');
  let server;
  t.after(async () => { if (server) await new Promise(resolve => server.close(resolve)); assert.equal(mongoose.connection.db.databaseName, database); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const models = [User, Session, CreditTransaction, StudySet, StudyReport, LearningResource];
  await Promise.all(models.map(model => model.init()));
  const [admin, student, moderator] = await User.create(['admin', 'student', 'moderator'].map(role => ({ name: `${role} Search Fixture`, email: `${role}@example.test`, password: randomBytes(16).toString('hex'), role, emailVerified: true, skillsToTeach: ['Math'] })));
  const oid = () => new mongoose.Types.ObjectId();
  const elizabeth = oid(); const legacy = oid();
  await User.collection.insertMany([
    { _id: elizabeth, name: 'Elizabeth Olson', email: 'elizabeth@example.test', role: 'student', emailVerified: true, skillsToTeach: ['Java', 'C++'] },
    { _id: legacy, name: 'Legacy Elizabeth', email: 'legacy@example.test', role: 'student', skillsToTeach: ['Python'] },
    { name: 'Elizabeth Unverified', email: 'unverified@example.test', role: 'student', emailVerified: false, skillsToTeach: ['Java'] },
    { name: 'Elizabeth Suspended', email: 'suspended@example.test', role: 'student', emailVerified: true, suspendedAt: new Date(), skillsToTeach: ['Java'] },
    { name: 'Elizabeth Staff', email: 'staff@example.test', role: 'moderator', emailVerified: true, skillsToTeach: ['Java'] },
    { name: 'Elizabeth Without Skills', email: 'noskills@example.test', role: 'student', emailVerified: true, skillsToTeach: [] },
    ...Array.from({ length: 30 }, (_, i) => ({ name: `Directory Fixture ${i}`, email: `directory${i}@example.test`, role: 'student', emailVerified: true, skillsToTeach: [] })),
  ]);
  const paid = oid(); const unpaid = oid();
  await Session.collection.insertMany([
    { _id: paid, learner: student._id, tutor: elizabeth, subject: 'C++', status: 'completed', creditAmount: 20, createdAt: new Date(), messages: ['PRIVATE FIXTURE'] },
    { _id: unpaid, learner: student._id, tutor: elizabeth, subject: 'Java', status: 'completed', creditAmount: 20 },
    { learner: student._id, tutor: elizabeth, subject: 'Java', status: 'scheduled' },
    { learner: student._id, tutor: elizabeth, subject: 'Java', status: 'accepted' },
    { learner: student._id, tutor: elizabeth, subject: 'Java', status: 'awaiting_validation' },
    { learner: student._id, tutor: elizabeth, subject: 'Java', status: 'disputed' },
  ]);
  await CreditTransaction.collection.insertOne({ type: 'session_payment', session: paid, fromUser: student._id, toUser: elizabeth, amount: 20, createdAt: new Date() });
  await StudySet.collection.insertMany([{ owner: student._id, title: 'Pending fixture', state: 'pending', deletedAt: null }, { owner: student._id, state: 'pending', deletedAt: new Date() }, { owner: student._id, state: 'private', deletedAt: null }]);
  await StudyReport.collection.insertMany([{ studySet: oid(), reporter: student._id, state: 'open' }, { studySet: oid(), reporter: student._id, state: 'closed' }]);
  await LearningResource.collection.insertMany([{ reviewStatus: 'submitted' }, { reviewStatus: 'published' }]);
  const app = express(); app.use('/api/users', require('../routes/userRoutes')); app.use('/api/admin', require('../routes/adminRoutes')); app.use(validationErrorHandler);
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const call = async (path, actor = student) => { const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { headers: { authorization: `Bearer ${jwt.sign({ id: String(actor._id), role: 'admin' }, process.env.JWT_SECRET)}` } }); return { status: response.status, body: await response.json() }; };
  await t.test('partial names are case insensitive and intersect subject filters without exposing private users', async () => {
    const result = await call('/users/tutors?q=ELIZA&subject=java'); assert.equal(result.status, 200);
    assert.deepEqual(result.body.data.map(row => row.name), ['Elizabeth Olson']); assert.equal(result.body.data[0].email, undefined);
    const historical = await call('/users/tutors?q=eliza&subject=Python'); assert.deepEqual(historical.body.data.map(row => row.name), ['Legacy Elizabeth']);
    assert.deepEqual((await call('/users/tutors?q=eliza&subject=Calculus')).body.data, []);
  });
  await t.test('teaching subject text is escaped and self discovery is excluded', async () => {
    assert.deepEqual((await call('/users/tutors?q=C%2B%2B')).body.data.map(row => row.name), ['Elizabeth Olson']);
    const result = await call('/users/tutors?q=Student'); assert.ok(!result.body.data.some(row => row._id === String(student._id)));
    assert.equal((await call('/users/tutors?q=eliza.*')).status, 400);
    assert.equal((await call('/users/tutors?q=eliza', moderator)).status, 403);
  });
  await t.test('Admin directory is paginated, searchable, bounded and permission protected', async () => {
    const first = await call('/admin/users?role=student&q=Directory', admin); assert.equal(first.status, 200); assert.equal(first.body.data.length, 25); assert.equal(first.body.pagination.total, 30);
    const second = await call('/admin/users?role=student&q=Directory&page=2', admin); assert.equal(second.body.data.length, 5);
    assert.ok(!second.body.data.some(row => first.body.data.some(old => old._id === row._id)));
    const target = await call('/admin/users?role=student&id=' + elizabeth, admin); assert.equal(target.body.data.length, 1);
    assert.equal((await call('/admin/users?page=-1', admin)).status, 400);
    assert.equal((await call('/admin/users?password=x', admin)).status, 400);
    assert.equal((await call('/admin/users', moderator)).status, 403);
    assert.equal((await call('/admin/users', student)).status, 403);
  });
  await t.test('session name queries retain ledger-based historical interpretation and omit private messages', async () => {
    const result = await call('/admin/sessions?q=eliza', admin); assert.equal(result.status, 200); assert.equal(result.body.pagination.total, 6);
    const rows = result.body.data; assert.equal(rows.find(row => row._id === String(paid)).canonicalStatus, 'completed'); assert.equal(rows.find(row => row._id === String(unpaid)).canonicalStatus, 'awaiting_validation');
    assert.ok(rows.every(row => !row.messages && !row.learner.email && !row.tutor.email));
    const scheduled = await call('/admin/sessions?status=scheduled', admin); assert.equal(scheduled.body.pagination.total, 2);
    assert.equal((await call('/admin/sessions?q=C%2B%2B', admin)).body.pagination.total, 1);
    assert.equal((await call('/admin/sessions', student)).status, 403);
  });
  await t.test('operational counts distinguish active records and do not invent settlement or draft submissions', async () => {
    const result = await call('/admin/operations', admin); assert.equal(result.status, 200);
    assert.equal(result.body.data.byStatus.awaiting_validation, 1); assert.equal(result.body.data.byStatus.disputed, 1);
    assert.equal(result.body.data.pendingResources, 1); assert.equal(result.body.data.pendingStudySets, 1); assert.equal(result.body.data.openStudyReports, 1);
    assert.equal(result.body.data.recentCredits.length, 1); assert.equal(result.body.data.recentCredits[0].amount, 20); assert.equal(result.body.data.recentCredits[0].fromUser, undefined);
    assert.equal((await call('/admin/operations', moderator)).status, 403);
    const activity = await call('/admin/credits/activity', admin);
    assert.equal(activity.status, 200); assert.equal(activity.body.data[0].toUserName, 'Elizabeth Olson');
    assert.equal(activity.body.data[0].fromUser, String(student._id));
    assert.equal(await CreditTransaction.countDocuments(), 1);
  });
});
