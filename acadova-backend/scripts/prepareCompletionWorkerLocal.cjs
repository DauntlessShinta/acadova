// Local CLI worker restart fixture. Never loads dotenv or accepts a URI argument.
const mongoose = require('mongoose');
const User = require('../models/User');
const Session = require('../models/Session');
const Notification = require('../models/Notification');
const sessions = require('../controllers/sessionController');
async function main() {
  if (process.env.ACADOVA_COMPLETION_WORKER_FIXTURE !== '1' || process.env.NODE_ENV === 'production') throw new Error('Explicit local worker fixture flag required');
  await mongoose.connect('mongodb://127.0.0.1:27029/acadova?replicaSet=acadovaPhase1', { serverSelectionTimeoutMS: 5000 });
  try {
    if ((await mongoose.connection.db.admin().command({ hello: 1 })).setName !== 'acadovaPhase1') throw new Error('Dedicated replica set required');
    await Promise.all([User.init(), Session.init(), Notification.init()]);
    if (process.argv.includes('--verify')) {
      const rows = await Session.find({ requestMessage: 'completion-worker-fixture' }).lean();
      const counts = { sessions: rows.length, reminders: await Notification.countDocuments({ type: 'session.validation_reminder' }), referrals: rows.filter((row) => row.reviewReferral).length,
        referredEvents: await Notification.countDocuments({ type: 'session.review_referred' }) };
      if (counts.sessions !== 2 || counts.reminders !== 4 || counts.referrals !== 1 || counts.referredEvents !== 4
        || rows.some((row) => row.disputedBy || row.creditsSettledAt || row.status !== 'awaiting_validation')) throw new Error('Worker restart evidence mismatch');
      console.log('Verified two separate worker processes deduplicated reminders/referral without settlement', counts); return;
    }
    if (await Session.countDocuments({ requestMessage: 'completion-worker-fixture' })) throw new Error('Worker fixture already prepared');
    const [learner, tutor] = await User.create(['learner', 'tutor'].map((name) => ({ name: `Worker ${name}`, email: `${name}@completion-worker.example.test`, password: 'fixture-password', role: 'student', emailVerified: true })));
    await User.create(['moderator', 'admin'].map((role) => ({ name: `Worker ${role}`, email: `${role}@completion-worker.example.test`, password: 'fixture-password', role, emailVerified: true })));
    const RealDate = Date;
    for (const hours of [49, 73]) {
      const finishedAt = RealDate.now() - hours * 3600000;
      const earlier = new RealDate(finishedAt - 3600000);
      const row = await Session.create({ learner: learner._id, tutor: tutor._id, subject: 'Worker completion fixture', creditAmount: 20,
        requestMessage: 'completion-worker-fixture', status: 'in_progress', scheduledAt: earlier, learnerCheckedInAt: earlier, tutorCheckedInAt: earlier, startedAt: earlier });
      global.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [finishedAt])); } static now() { return finishedAt; } };
      try {
        const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
        await sessions.finishSession({ params: { id: String(row._id) }, user: { id: String(tutor._id), role: 'student' }, body: {} }, res);
        if (res.statusCode !== 200) throw new Error('Local finish failed');
      } finally { global.Date = RealDate; }
    }
    console.log('Prepared two synthetic, controller-finished local Sessions at controlled ages 49/73 hours');
  } finally { await mongoose.disconnect(); }
}
main().catch((error) => { console.error(error.name, error.message); process.exitCode = 1; });
