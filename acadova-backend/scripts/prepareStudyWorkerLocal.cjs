// Synthetic fixed-loopback worker fixture. Never dotenv, production URI or real users.
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/User');
const StudySet = require('../models/StudySet');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const CreditTransaction = require('../models/CreditTransaction');
async function run() {
  assert.equal(process.env.ACADOVA_STUDY_WORKER_FIXTURE, '1'); assert.notEqual(process.env.NODE_ENV, 'production');
  await mongoose.connect('mongodb://127.0.0.1:27029/acadova?replicaSet=acadovaPhase1', { serverSelectionTimeoutMS: 5000 });
  assert.equal(mongoose.connection.host, '127.0.0.1'); assert.equal((await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'acadovaPhase1');
  await Promise.all([User.init(), StudySet.init(), Notification.init(), AuditLog.init(), CreditTransaction.init()]);
  if (process.argv.includes('--verify')) {
    const rows = await Notification.find({ relatedType: 'StudySet', type: 'study.published' });
    assert.equal(rows.length, 1); assert.equal(rows[0].pushStatus, 'skipped'); assert.equal(rows[0].pushAttempts, 1);
    assert.equal(await AuditLog.countDocuments({ action: 'study.publication_decided' }), 1); assert.equal(await CreditTransaction.countDocuments(), 0);
    assert.equal((await User.findOne({ email: 'study-worker-owner@example.test' })).credits, 100);
    console.log('Verified durable study publication event survives two worker processes; providers skipped, one claim, no credit event.');
  } else {
    assert.equal(await StudySet.countDocuments(), 0, 'Only prepare an empty dedicated fixture database');
    const [owner, staff] = await User.create(['owner', 'staff'].map(kind => ({ name: 'Study Worker Fixture ' + kind, email: `study-worker-${kind}@example.test`, password: 'fixture-only-password', role: kind === 'owner' ? 'student' : 'moderator', emailVerified: true, credits: 100 })));
    const row = await StudySet.create({ owner: owner._id, title: 'Worker study fixture', subject: 'Testing', state: 'pending', questions: [{ prompt: 'Fixture question', options: ['A', 'B'], correctIndex: 0 }] });
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await require('../controllers/studyModerationController').decide({ params: { id: String(row._id) }, user: { id: String(staff._id), role: 'moderator' }, body: { version: 1, outcome: 'approve', reason: 'Synthetic local worker review only.' } }, res);
    assert.equal(res.statusCode, 200); assert.equal(await Notification.countDocuments({ pushStatus: 'pending' }), 1);
    console.log('Prepared one synthetic study publication with transactional audit and pending Notification.');
  }
  await mongoose.disconnect();
}
run().catch(async error => { console.error(error.message); await mongoose.disconnect(); process.exitCode = 1; });
