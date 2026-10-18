const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const service = require('../services/expAwardService');
const User = require('../models/User');
const Assessment = require('../models/Assessment');
const Attempt = require('../models/AssessmentAttempt');
const Session = require('../models/Session');
const Credit = require('../models/CreditTransaction');
const Audit = require('../models/AuditLog');
const Award = require('../models/ExpAward');
const Lock = require('../models/ExpAccountLock');
const Ledger = require('../models/ExpLedgerEntry');
const { ACTIONS } = require('../services/auditService');
test('EXP engine on a fresh explicitly isolated loopback replica set', { skip: process.env.ACADOVA_EXP_ENGINE_DB_TESTS !== '1' }, async t => {
  assert.equal(process.env.NODE_ENV, 'test');
  const database = 'acadova_exp_engine_test_' + randomUUID().replaceAll('-', '');
  await mongoose.connect('mongodb://127.0.0.1:27032/admin?directConnection=true', { serverSelectionTimeoutMS: 5000 });
  try { await mongoose.connection.db.admin().command({ replSetInitiate: { _id: 'acadovaExpQA', members: [{ _id: 0, host: '127.0.0.1:27032' }] } }); }
  catch (error) { if (error.codeName !== 'AlreadyInitialized') throw error; }
  await mongoose.disconnect();
  await mongoose.connect(`mongodb://127.0.0.1:27032/${database}?replicaSet=acadovaExpQA`, { serverSelectionTimeoutMS: 20000 });
  t.after(async () => { assert.equal(mongoose.connection.name, database); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  for (const model of [User, Assessment, Attempt, Session, Credit, Audit, Award, Lock, Ledger]) { await model.createCollection(); await model.createIndexes(); }
  let tick = new Date('2026-10-17T12:00:00Z'); let serial = 0;
  const actor = async (role = 'student', changes = {}) => User.create({ name: 'Synthetic EXP actor', email: `exp${++serial}@phinmaed.com`, password: 'synthetic-not-a-login', role, emailVerified: true, credits: 100, ...changes });
  const admin = await actor('admin'); const moderator = await actor('moderator');
  const student = await actor(); const learner = await actor();
  const engine = await service.createIsolatedExpEngine({ clock: () => tick });
  const configuredEngine = async values => {
    const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
    Object.assign(process.env, values);
    try { return await service.createIsolatedExpEngine({ clock: () => tick }); }
    finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
  };
  const milestone = async (owner = student, changes = {}) => {
    const publishedAt = new Date(tick - 60000);
    const assessment = await Assessment.create({ title: 'Synthetic official milestone', topic: 'Synthetic', status: 'published', createdBy: moderator._id,
      approvedBy: moderator._id, publishedAt, passingScore: 70,
      questions: [0, 1, 2].map(i => ({ prompt: 'Synthetic question ' + i, options: ['Correct', 'Other'], correctIndex: 0 })) });
    await Audit.create({ actor: moderator._id, actorRole: 'moderator', action: ACTIONS.assessmentPublished,
      targetType: 'Assessment', targetId: String(assessment._id), summary: 'Synthetic publication', createdAt: publishedAt });
    const attempt = await Attempt.create({ student: owner._id, assessment: assessment._id, mode: 'official', answers: [0, 0, 0], passed: true, score: 100, submittedAt: new Date(tick - 1000), ...changes });
    return { assessment, attempt };
  };
  const completedSession = async (tutor = student, pupil = learner, changes = {}) => {
    const start = new Date(tick - 30 * 60000);
    return Session.create({ learner: pupil._id, tutor: tutor._id, subject: 'Synthetic tutoring', creditAmount: 20,
      lifecycleVersion: 1, status: 'completed', scheduledAt: start, learnerCheckedInAt: start, tutorCheckedInAt: start,
      startedAt: start, awaitingValidationAt: new Date(tick - 5 * 60000), learnerConfirmedAt: new Date(tick - 4 * 60000),
      tutorConfirmedAt: new Date(tick - 3 * 60000), completedAt: new Date(tick - 2 * 60000), ...changes });
  };
  const wallets = () => User.find().select('_id credits rewardedAssessments openingGrantEligible').sort({ _id: 1 }).lean().then(JSON.stringify);
  const creditRows = () => Credit.find().sort({ _id: 1 }).lean().then(JSON.stringify);
  await Credit.create({ type: 'initial_grant', toUser: student._id, amount: 100 });
  let firstAward;
  await t.test('first official completion uses actual records, grading, publication audit and concurrent deterministic idempotency', async () => {
    const { attempt } = await milestone();
    const beforeWallet = await wallets(); const beforeCredits = await creditRows();
    const results = await Promise.all(Array.from({ length: 6 }, () => engine.awardAssessment(String(attempt._id))));
    assert.equal(new Set(results.map(row => String(row._id))).size, 1); firstAward = results[0];
    assert.equal(firstAward.amount, 20); assert.equal(firstAward.status, 'finalized');
    assert.equal(await Ledger.countDocuments({ award: firstAward._id, kind: 'official_assessment' }), 1);
    assert.equal(await Audit.countDocuments({ action: ACTIONS.expFinalized, targetId: String(firstAward._id) }), 1);
    assert.equal(await wallets(), beforeWallet); assert.equal(await creditRows(), beforeCredits);
  });
  await t.test('private/practice, forged grading, later official attempts, missing publication evidence and unverified accounts cannot award', async () => {
    for (const changes of [{ mode: 'practice' }, { passed: false }, { answers: [1, 1, 1], score: 100 }, { score: 99 }]) {
      const { attempt } = await milestone(student, changes); await assert.rejects(engine.awardAssessment(String(attempt._id)), { code: 'EXP_ASSESSMENT_EVIDENCE' });
    }
    const { assessment, attempt } = await milestone();
    await Audit.deleteMany({ targetId: String(assessment._id) });
    await assert.rejects(engine.awardAssessment(String(attempt._id)), { code: 'EXP_ASSESSMENT_EVIDENCE' });
    const malformed = await milestone();
    await Assessment.collection.updateOne({ _id: malformed.assessment._id }, { $set: { passingScore: 0 } });
    await assert.rejects(engine.awardAssessment(String(malformed.attempt._id)), { code: 'EXP_ASSESSMENT_EVIDENCE' });
    const original = await milestone();
    const later = await Attempt.create({ student: student._id, assessment: original.assessment._id, mode: 'official', passed: true, score: 100, answers: [0, 0, 0], submittedAt: tick });
    await assert.rejects(engine.awardAssessment(String(later._id)), { code: 'EXP_ASSESSMENT_EVIDENCE' });
    const unverified = await actor('student', { emailVerified: false }); const invalid = await milestone(unverified);
    await assert.rejects(engine.awardAssessment(String(invalid.attempt._id)), { code: 'EXP_STUDENT_INELIGIBLE' });
    await assert.rejects(engine.awardAssessment({ amount: 999, role: 'admin' }), { code: 'EXP_INVALID_ID' });
  });
  await t.test('audit failure rolls back the award, ledger and source writes atomically and remains retryable', async () => {
    const { attempt } = await milestone(); const before = await Award.countDocuments();
    const create = Audit.create; Audit.create = async () => { throw new Error('Synthetic audit outage'); };
    try { await assert.rejects(engine.awardAssessment(String(attempt._id)), /Synthetic audit outage/); }
    finally { Audit.create = create; }
    assert.equal(await Award.countDocuments(), before); assert.equal(await Ledger.countDocuments({ sourceId: attempt._id }), 0);
    assert.equal((await engine.awardAssessment(String(attempt._id))).status, 'finalized');
  });
  await t.test('tutoring requires ordered canonical mutual completion and minimum duration; pending reserves no ledger balance', async () => {
    for (const changes of [{ lifecycleVersion: undefined }, { learnerConfirmedAt: undefined }, { status: 'awaiting_validation' },
      { disputedAt: tick }, { learner: student._id }, { startedAt: new Date(tick - 6 * 60000) },
      { scheduledAt: new Date(tick - 14 * 60000) }, { scheduledAt: new Date(tick - (30 + 241) * 60000) }]) {
      const row = await completedSession(student, learner, changes);
      await assert.rejects(engine.queueTutoring(String(row._id)), /required/);
    }
    const early = await completedSession(await actor(), await actor(), { scheduledAt: new Date(tick - 20 * 60000) });
    assert.equal((await engine.queueTutoring(String(early._id))).status, 'pending', 'Legitimate ten-minute-early check-ins remain eligible');
    const row = await completedSession();
    const claims = await Promise.all([engine.queueTutoring(String(row._id)), engine.queueTutoring(String(row._id))]);
    assert.equal(String(claims[0]._id), String(claims[1]._id)); assert.equal(claims[0].status, 'pending');
    assert.equal(await Ledger.countDocuments({ award: claims[0]._id }), 0);
    await assert.rejects(engine.finalizeTutoring(String(claims[0]._id)), { code: 'EXP_AWARD_HELD' });
    const reciprocal = await completedSession(learner, student);
    await assert.rejects(engine.queueTutoring(String(reciprocal._id)), { code: 'EXP_TUTORING_CAP' });
  });
  let tutorAward;
  await t.test('report holds survive the review window; authorized release still revalidates source and finalization is once-only', async () => {
    tutorAward = await Award.findOne({ owner: student._id, kind: 'verified_tutoring' }).lean();
    await assert.rejects(engine.holdTutoring(String(tutorAward._id), String(learner._id), 'Participant cannot moderate'), { code: 'EXP_CORRECTION_FORBIDDEN' });
    await engine.holdTutoring(String(tutorAward._id), String(moderator._id), 'Synthetic report requires review');
    tick = new Date(tick.getTime() + 49 * 3600000);
    await assert.rejects(engine.finalizeTutoring(String(tutorAward._id)), { code: 'EXP_AWARD_HELD' });
    await engine.releaseTutoringHold(String(tutorAward._id), String(moderator._id), 'Synthetic report evidence cleared');
    await Session.updateOne({ _id: tutorAward.sourceId }, { $set: { disputedAt: tick } });
    await assert.rejects(engine.finalizeTutoring(String(tutorAward._id)), { code: 'EXP_TUTORING_EVIDENCE' });
    await Session.updateOne({ _id: tutorAward.sourceId }, { $unset: { disputedAt: 1 } });
    await Session.updateOne({ _id: tutorAward.sourceId }, { $set: { tutor: learner._id, learner: student._id } });
    await assert.rejects(engine.finalizeTutoring(String(tutorAward._id)), { code: 'EXP_EVIDENCE_CHANGED' });
    await Session.updateOne({ _id: tutorAward.sourceId }, { $set: { tutor: student._id, learner: learner._id, completedAt: new Date(tutorAward.occurredAt.getTime() + 86400000) } });
    await assert.rejects(engine.finalizeTutoring(String(tutorAward._id)), { code: 'EXP_EVIDENCE_CHANGED' });
    await Session.updateOne({ _id: tutorAward.sourceId }, { $set: { completedAt: tutorAward.occurredAt } });
    const results = await Promise.all(Array.from({ length: 4 }, () => engine.finalizeTutoring(String(tutorAward._id))));
    assert.ok(results.every(row => row.status === 'finalized')); assert.equal(await Ledger.countDocuments({ award: tutorAward._id }), 1);
  });
  await t.test('corrections re-read authorized staff, append an exact negative once, audit reason/actor and never refund abuse caps', async () => {
    const entry = await Ledger.findOne({ award: firstAward._id }).lean();
    await assert.rejects(engine.reverseAward(String(entry._id), String(student._id), 'Student cannot correct awards'), { code: 'EXP_CORRECTION_FORBIDDEN' });
    await assert.rejects(engine.reverseAward(String(entry._id), String(moderator._id), 'Moderator cannot reverse EXP'), { code: 'EXP_CORRECTION_FORBIDDEN' });
    await User.updateOne({ _id: admin._id }, { $set: { suspendedAt: tick } });
    await assert.rejects(engine.reverseAward(String(entry._id), String(admin._id), 'Suspended staff cannot correct'), { code: 'EXP_CORRECTION_FORBIDDEN' });
    await User.updateOne({ _id: admin._id }, { $unset: { suspendedAt: 1 } });
    const beforeWallet = await wallets(); const beforeCredits = await creditRows();
    const create = Audit.create; Audit.create = async () => { throw new Error('Synthetic correction audit outage'); };
    try { await assert.rejects(engine.reverseAward(String(entry._id), String(admin._id), 'Synthetic invalid milestone evidence'), /Synthetic correction audit outage/); }
    finally { Audit.create = create; }
    assert.equal(await Ledger.countDocuments({ reversalOf: entry._id }), 0);
    assert.equal((await Award.findById(firstAward._id).lean()).status, 'finalized');
    const reversals = await Promise.all(Array.from({ length: 4 }, () => engine.reverseAward(String(entry._id), String(admin._id), 'Synthetic invalid milestone evidence')));
    assert.equal(new Set(reversals.map(row => String(row._id))).size, 1); assert.equal(reversals[0].delta, -20);
    assert.equal(reversals[0].policyVersion, entry.policyVersion);
    assert.equal((await Ledger.findById(entry._id).lean()).delta, 20);
    const audit = await Audit.findOne({ action: ACTIONS.expReversed, targetId: String(reversals[0]._id) }).lean();
    assert.equal(String(audit.actor), String(admin._id)); assert.equal(audit.metadata.reason, 'Synthetic invalid milestone evidence');
    assert.equal((await Award.findById(firstAward._id).lean()).status, 'reversed');
    assert.equal(await wallets(), beforeWallet); assert.equal(await creditRows(), beforeCredits);
    await assert.rejects(Ledger.updateOne({ _id: entry._id }, { $set: { delta: 999 } }), /append-only/);
    await assert.rejects((await Ledger.findById(entry._id)).deleteOne(), /append-only/);
  });
  await t.test('daily/weekly caps serialize distinct concurrent events; reversed claims cannot bypass limits', async () => {
    const capped = await actor(); const previous = process.env.EXP_DAILY_AWARDS; const previousWeek = process.env.EXP_WEEKLY_AWARDS;
    process.env.EXP_DAILY_AWARDS = '1'; process.env.EXP_WEEKLY_AWARDS = '1';
    let limited; try { limited = await service.createIsolatedExpEngine({ clock: () => tick }); }
    finally { if (previous === undefined) delete process.env.EXP_DAILY_AWARDS; else process.env.EXP_DAILY_AWARDS = previous; if (previousWeek === undefined) delete process.env.EXP_WEEKLY_AWARDS; else process.env.EXP_WEEKLY_AWARDS = previousWeek; }
    const a = await milestone(capped); const b = await milestone(capped);
    const races = await Promise.allSettled([limited.awardAssessment(String(a.attempt._id)), limited.awardAssessment(String(b.attempt._id))]);
    assert.equal(races.filter(row => row.status === 'fulfilled').length, 1);
    assert.equal(races.find(row => row.status === 'rejected').reason.code, 'EXP_AWARD_CAP');
    const award = races.find(row => row.status === 'fulfilled').value; const entry = await Ledger.findOne({ award: award._id }).lean();
    await limited.reverseAward(String(entry._id), String(admin._id), 'Synthetic cap reversal test');
    tick = new Date(tick.getTime() + 24 * 3600000);
    const c = await milestone(capped); await assert.rejects(limited.awardAssessment(String(c.attempt._id)), { code: 'EXP_AWARD_CAP' });
  });
  await t.test('missing uniqueness indexes fail closed; neither client-like payloads nor env switches enable live methods', async () => {
    await Award.collection.dropIndex('uniq_exp_claim_owner_event');
    await assert.rejects(engine.queueTutoring(String(tutorAward.sourceId)), { code: 'EXP_INDEXES_REQUIRED' });
    await Award.createIndexes(); process.env.EXP_ACTIVE = 'true';
    try { await assert.rejects(service.awardAssessment({ attemptId: 'anything', amount: 999 }), { code: 'EXP_NOT_ACTIVE' }); }
    finally { delete process.env.EXP_ACTIVE; }
    await assert.rejects(Ledger.bulkWrite([{ deleteMany: { filter: {} } }]), /append-only/);
  });
  await t.test('tutoring daily and weekly reservations and unordered reciprocal-pair weekly caps are enforced independently', async () => {
    const limited = await configuredEngine({ EXP_TUTORING_DAILY_AWARDS: '1', EXP_TUTORING_WEEKLY_AWARDS: '1' });
    const tutor = await actor(); const peers = [await actor(), await actor(), await actor()];
    const first = await completedSession(tutor, peers[0]); await limited.queueTutoring(String(first._id));
    const second = await completedSession(tutor, peers[1]); await assert.rejects(limited.queueTutoring(String(second._id)), { code: 'EXP_TUTORING_CAP' });
    tick = new Date(tick.getTime() + 86400000);
    const third = await completedSession(tutor, peers[2]); await assert.rejects(limited.queueTutoring(String(third._id)), { code: 'EXP_TUTORING_CAP' });
    const pairEngine = await configuredEngine({ EXP_PAIR_WEEKLY_AWARDS: '1' }); const a = await actor(); const b = await actor();
    const original = await completedSession(a, b); await pairEngine.queueTutoring(String(original._id));
    tick = new Date(tick.getTime() + 86400000);
    const reciprocal = await completedSession(b, a); await assert.rejects(pairEngine.queueTutoring(String(reciprocal._id)), { code: 'EXP_TUTORING_CAP' });
  });
  await t.test('delayed finalizations have their own serialized caps, even when reservations occurred on different days', async () => {
    const limited = await configuredEngine({ EXP_TUTORING_DAILY_AWARDS: '1' }); const tutor = await actor();
    const first = await completedSession(tutor, await actor()); const a = await limited.queueTutoring(String(first._id));
    tick = new Date(tick.getTime() + 86400000);
    const second = await completedSession(tutor, await actor()); const b = await limited.queueTutoring(String(second._id));
    tick = new Date(tick.getTime() + 3 * 86400000);
    const races = await Promise.allSettled([limited.finalizeTutoring(String(a._id)), limited.finalizeTutoring(String(b._id))]);
    assert.equal(races.filter(row => row.status === 'fulfilled').length, 1);
    assert.equal(races.find(row => row.status === 'rejected').reason.code, 'EXP_TUTORING_CAP');
    assert.equal(await Ledger.countDocuments({ owner: tutor._id }), 1);
  });
  await t.test('held awards cannot race into a ledger while their report window remains open', async () => {
    const tutor = await actor(); const row = await completedSession(tutor, await actor()); const claim = await engine.queueTutoring(String(row._id));
    const races = await Promise.allSettled([engine.finalizeTutoring(String(claim._id)), engine.holdTutoring(String(claim._id), String(moderator._id), 'Synthetic report arrived during window')]);
    assert.equal(races[0].status, 'rejected'); assert.equal(races[0].reason.code, 'EXP_AWARD_HELD'); assert.equal(races[1].status, 'fulfilled');
    assert.equal((await Award.findById(claim._id).lean()).status, 'held'); assert.equal(await Ledger.countDocuments({ award: claim._id }), 0);
  });
  await t.test('existing credit settlement remains operational and separate from the hard-off EXP service', async () => {
    const tutor = await actor(); const pupil = await actor(); const row = await completedSession(tutor, pupil);
    const expCount = await Ledger.countDocuments(); const claimCount = await Award.countDocuments();
    const tx = await mongoose.startSession();
    try { await tx.withTransaction(async () => {
      const claimed = await Session.findOneAndUpdate({ _id: row._id, creditsSettledAt: null }, { $set: { creditsSettledAt: tick } }, { session: tx, returnDocument: 'after' });
      assert.ok(claimed); await require('../services/sessionSettlement').transferSessionCredits(claimed, tx);
    }); } finally { await tx.endSession(); }
    assert.equal((await User.findById(tutor._id).lean()).credits, 120); assert.equal((await User.findById(pupil._id).lean()).credits, 80);
    assert.equal(await Credit.countDocuments({ session: row._id, type: 'session_payment', amount: 20 }), 1);
    assert.equal(await Ledger.countDocuments(), expCount); assert.equal(await Award.countDocuments(), claimCount);
    await assert.rejects(service.queueTutoring(String(row._id)), { code: 'EXP_NOT_ACTIVE' });
  });
});
