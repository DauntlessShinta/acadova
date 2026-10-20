const mongoose = require('mongoose');
const User = require('../models/User');
const Assessment = require('../models/Assessment');
const Attempt = require('../models/AssessmentAttempt');
const Session = require('../models/Session');
const Award = require('../models/ExpAward');
const Lock = require('../models/ExpAccountLock');
const Ledger = require('../models/ExpLedgerEntry');
const Audit = require('../models/AuditLog');
const { ACTIONS, recordAudit } = require('./auditService');
const { requireExpActivation, tutoringEvent, correctionEntry } = require('./growthFoundation');
const { expEnginePolicy } = require('../config/growthPolicy');

const fail = (code, message, status = 409) => { throw Object.assign(new Error(message), { code, status }); };
const id = value => {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) fail('EXP_INVALID_ID', 'A server record ID is required.', 400);
  return value.toLowerCase();
};
const same = (a, b) => String(a) === String(b);
const note = reason => {
  if (typeof reason !== 'string' || reason.trim().length < 10 || reason.trim().length > 500 || /[\p{Cc}\p{Cf}]/u.test(reason)) {
    fail('EXP_REASON_REQUIRED', 'Supply a bounded audit reason.', 400);
  }
  return reason.trim();
};
function utcWindows(now) {
  const day = new Date(now); day.setUTCHours(0, 0, 0, 0);
  const week = new Date(day); week.setUTCDate(week.getUTCDate() - (week.getUTCDay() + 6) % 7);
  return { day, week };
}
async function assertIndexes() {
  try {
    const exact = (row, name, keys) => row.name === name && row.unique === true
      && JSON.stringify(row.key) === JSON.stringify(keys) && !row.sparse && !row.partialFilterExpression;
    const ledger = await Ledger.collection.indexes(); const claims = await Award.collection.indexes();
    if (!ledger.some(row => exact(row, 'uniq_exp_owner_event', { owner: 1, eventKey: 1 }))
      || !ledger.some(row => row.name === 'uniq_exp_reversal' && row.unique === true
        && JSON.stringify(row.key) === JSON.stringify({ reversalOf: 1 }) && !row.sparse
        && JSON.stringify(row.partialFilterExpression) === JSON.stringify({ reversalOf: { $exists: true } }))
      || !claims.some(row => exact(row, 'uniq_exp_claim_owner_event', { owner: 1, eventKey: 1 }))) throw new Error();
    await Lock.collection.indexes();
  } catch { fail('EXP_INDEXES_REQUIRED', 'Verified EXP uniqueness indexes are required.', 503); }
}

// Not exported: all production-facing entry points below fail before reaching this engine.
function engine(clock, policy, newEventsOnly = false) {
  const now = () => { const value = new Date(clock()); if (!Number.isFinite(value.getTime())) fail('EXP_CLOCK_INVALID', 'Server clock unavailable.', 503); return value; };
  async function transaction(participants, write) {
    await assertIndexes();
    const ids = [...new Set(participants.map(value => id(String(value))))].sort();
    for (const user of ids) {
      try { await Lock.updateOne({ _id: user }, { $setOnInsert: { revision: 0 } }, { upsert: true }); }
      catch (error) { if (error.code !== 11000) throw error; }
    }
    const tx = await mongoose.startSession();
    try {
      let result;
      await tx.withTransaction(async () => {
        const users = new Map();
        for (const user of ids) {
          const lock = await Lock.updateOne({ _id: user, revision: { $lt: Number.MAX_SAFE_INTEGER } }, { $inc: { revision: 1 } }, { session: tx });
          if (lock.modifiedCount !== 1) fail('EXP_LOCK_UNAVAILABLE', 'Award coordination is unavailable.', 503);
          // Reuse the existing participant write-fence convention. Never change credits.
          const row = await User.findOneAndUpdate({ _id: user }, { $currentDate: { updatedAt: true } },
            { session: tx, timestamps: false, returnDocument: 'after' }).lean();
          if (!row) fail('EXP_ACCOUNT_UNAVAILABLE', 'An award participant is unavailable.');
          users.set(user, row);
        }
        result = await write(tx, users, now());
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
      return result;
    } finally { await tx.endSession(); }
  }
  const student = row => {
    if (row?.role !== 'student' || row.emailVerified !== true || row.suspendedAt) fail('EXP_STUDENT_INELIGIBLE', 'A verified active Student is required.');
  };
  const staff = (row, award, admin = false) => {
    if (!row || !(admin ? ['admin'] : ['admin', 'moderator']).includes(row.role) || row.emailVerified !== true
      || row.suspendedAt || same(row._id, award.owner) || award.learner && same(row._id, award.learner)) {
      fail('EXP_CORRECTION_FORBIDDEN', 'An independent authorized staff account is required.', 403);
    }
    return { id: String(row._id), role: row.role };
  };
  async function fence(Model, sourceId, tx) {
    const query=Model.findOneAndUpdate({ _id: sourceId }, { $currentDate: { updatedAt: true } },
      { session: tx, timestamps: false, returnDocument: 'after' });
    return (Model===Session?query.select('+expReport'):query).lean();
  }
  async function systemAudit(action, award, tx) {
    await Audit.create([{ actorRole: 'system', action, targetType: 'ExpAward', targetId: String(award._id),
      summary: action === ACTIONS.expPending ? 'Verified tutoring EXP reserved pending review window' : 'Verified EXP award finalized',
      metadata: { amount: award.amount, kind: award.kind, policyVersion: award.policy.version } }], { session: tx });
  }
  async function caps(owner, pairKey, kind, timestamp, at, tx) {
    const { day, week } = utcWindows(at);
    const count = (from, extra = {}) => Award.countDocuments({ [timestamp]: { $gte: from }, ...extra }).session(tx);
    if (await count(day, { owner }) >= policy.dailyAwards || await count(week, { owner }) >= policy.weeklyAwards) {
      fail('EXP_AWARD_CAP', 'The configured daily or weekly award cap has been reached.');
    }
    if (kind === 'verified_tutoring' && (await count(day, { owner, kind }) >= policy.tutoringDaily
      || await count(week, { owner, kind }) >= policy.tutoringWeekly
      || await count(day, { pairKey }) >= policy.pairDaily || await count(week, { pairKey }) >= policy.pairWeekly)) {
      fail('EXP_TUTORING_CAP', 'Tutoring or repeated-pair limits have been reached.');
    }
  }
  async function writeLedger(award, at, tx) {
    const [entry] = await Ledger.create([{ owner: award.owner, eventKey: award.eventKey, kind: award.kind,
      sourceId: award.sourceId, award: award._id, delta: award.amount, policyVersion: award.policy.version,
      reason: award.kind === 'official_assessment' ? 'First verified official assessment milestone' : 'Verified tutoring after the reporting window', createdAt: at }], { session: tx });
    await systemAudit(ACTIONS.expFinalized, award, tx);
    return entry.toObject();
  }
  async function sessionEvidence(sessionId, tx, users, at, frozenPolicy = policy) {
    const row = await fence(Session, sessionId, tx);
    if (!row || !users.has(String(row.tutor)) || !users.has(String(row.learner))) fail('EXP_EVIDENCE_CHANGED', 'Session participants changed.');
    student(users.get(String(row.tutor))); student(users.get(String(row.learner)));
    if(newEventsOnly && row.economyVersion!=='free-v1' || row.expReport?.status==='open' || row.expReport?.status==='upheld') fail('EXP_REPORT_HOLD','This contribution requires review.');
    // Match the existing check-in workflow: 15 minutes early through 4 hours late.
    const inCheckInWindow = time => time >= new Date(row.scheduledAt).getTime() - 15 * 60000
      && time <= new Date(row.scheduledAt).getTime() + 4 * 3600000;
    if (!tutoringEvent(row.tutor, row) || row.completedAt > at
      || ![row.learnerCheckedInAt, row.tutorCheckedInAt].every(inCheckInWindow)
      || row.noShowAt || row.resolution || row.reviewReferral && !row.reviewReferral.closedAt
      || row.awaitingValidationAt - row.startedAt < Math.max(policy.minimumMinutes, frozenPolicy.minimumMinutes) * 60000) {
      fail('EXP_TUTORING_EVIDENCE', 'Canonical mutual completion, minimum duration and clear review evidence are required.');
    }
    return row;
  }
  async function awardAssessment(attemptId) {
    attemptId = id(attemptId); const initial = await Attempt.findById(attemptId).lean();
    if (!initial) fail('EXP_EVIDENCE_MISSING', 'Official attempt not found.', 404);
    return transaction([initial.student], async (tx, users, at) => {
      const attempt = await fence(Attempt, attemptId, tx);
      if (!attempt || !users.has(String(attempt.student))) fail('EXP_EVIDENCE_CHANGED', 'Attempt owner changed.');
      student(users.get(String(attempt.student)));
      if(newEventsOnly && attempt.progressionVersion!=='student-free-exp-1') fail('EXP_HISTORICAL_EVENT','Historical events are not replayed.');
      const assessment = await fence(Assessment, attempt.assessment, tx);
      const first = await Attempt.findOne({ student: attempt.student, assessment: attempt.assessment, mode: newEventsOnly?{$ne:'practice'}:'official', passed: true })
        .sort({ submittedAt: 1, _id: 1 }).session(tx).lean();
      if (!assessment || assessment.status !== 'published' || !assessment.approvedBy || same(assessment.approvedBy, attempt.student)
        || !assessment.publishedAt || attempt.mode !== 'official' || attempt.passed !== true
        || !attempt.submittedAt || attempt.submittedAt < assessment.publishedAt || attempt.submittedAt > at
        || !same(first?._id, attempt._id) || attempt.answers.length !== assessment.questions.length
        || assessment.questions.length < 3 || assessment.questions.length > 10
        || !Number.isFinite(assessment.passingScore) || assessment.passingScore < 1 || assessment.passingScore > 100
        || assessment.questions.some(question => !Array.isArray(question.options) || question.options.length < 2
          || question.options.length > 5 || !Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= question.options.length)
        || attempt.answers.some((answer, i) => !Number.isInteger(answer) || answer < 0 || answer >= assessment.questions[i].options.length)) {
        fail('EXP_ASSESSMENT_EVIDENCE', 'A first eligible published official assessment milestone is required.');
      }
      const correct = attempt.answers.filter((answer, i) => answer === assessment.questions[i].correctIndex).length;
      if (attempt.score !== Math.round(correct * 100 / assessment.questions.length)
        || correct * 100 < assessment.passingScore * assessment.questions.length
        || !await Audit.exists({ action: ACTIONS.assessmentPublished, targetType: 'Assessment', targetId: String(assessment._id),
          actor: assessment.approvedBy, actorRole: { $in: ['admin', 'moderator'] },
          createdAt: { $gte: assessment.publishedAt, $lte: attempt.submittedAt } }).session(tx)) {
        fail('EXP_ASSESSMENT_EVIDENCE', 'Server grading and publication audit evidence must match.');
      }
      const eventKey = `assessment:${assessment._id}`;
      const existing = await Award.findOne({ owner: attempt.student, eventKey }).session(tx).lean();
      if (existing) return existing;
      await caps(attempt.student, null, 'official_assessment', 'createdAt', at, tx);
      await caps(attempt.student, null, 'official_assessment', 'finalizedAt', at, tx);
      const [award] = await Award.create([{ owner: attempt.student, eventKey, sourceId: attempt._id, assessment: assessment._id,
        kind: 'official_assessment', amount: policy.assessmentAmount, status: 'finalized', occurredAt: attempt.submittedAt,
        finalizedAt: at, createdAt: at, policy }], { session: tx });
      await writeLedger(award, at, tx); return award.toObject();
    });
  }
  async function queueTutoring(sessionId) {
    sessionId = id(sessionId); const initial = await Session.findById(sessionId).lean();
    if (!initial) fail('EXP_EVIDENCE_MISSING', 'Session not found.', 404);
    return transaction([initial.tutor, initial.learner], async (tx, users, at) => {
      const row = await sessionEvidence(sessionId, tx, users, at);
      const eventKey = `session:${row._id}`;
      const existing = await Award.findOne({ owner: row.tutor, eventKey }).session(tx).lean();
      if (existing) return existing;
      const pairKey = [String(row.tutor), String(row.learner)].sort().join(':');
      await caps(row.tutor, pairKey, 'verified_tutoring', 'createdAt', at, tx);
      const [award] = await Award.create([{ owner: row.tutor, learner: row.learner, pairKey, eventKey,
        sourceId: row._id, kind: 'verified_tutoring', amount: policy.tutoringAmount, status: 'pending',
        occurredAt: row.completedAt, readyAt: new Date(row.completedAt.getTime() + policy.reportWindowHours * 3600000), createdAt: at, policy }], { session: tx });
      await systemAudit(ACTIONS.expPending, award, tx); return award.toObject();
    });
  }
  async function awardContext(awardId) {
    const row = await Award.findById(id(awardId)).lean();
    if (!row) fail('EXP_EVIDENCE_MISSING', 'Award not found.', 404);
    return row;
  }
  async function finalizeTutoring(awardId) {
    const initial = await awardContext(awardId);
    return transaction([initial.owner, initial.learner].filter(Boolean), async (tx, users, at) => {
      const award = await Award.findById(initial._id).session(tx).lean();
      if (award.kind !== 'verified_tutoring') fail('EXP_KIND_INVALID', 'Only tutoring has a pending window.');
      if (['finalized', 'reversed'].includes(award.status)) return award;
      if (award.status !== 'pending' || award.readyAt > at) fail('EXP_AWARD_HELD', 'The reporting window or staff hold remains open.');
      const source = await sessionEvidence(award.sourceId, tx, users, at, award.policy);
      if (!same(source.tutor, award.owner) || !same(source.learner, award.learner)
        || source.completedAt.getTime() !== award.occurredAt.getTime()) {
        fail('EXP_EVIDENCE_CHANGED', 'Pending award participants or completion evidence changed.');
      }
      if (source.completedAt.getTime() + Math.max(policy.reportWindowHours, award.policy.reportWindowHours) * 3600000 > at.getTime()) {
        fail('EXP_AWARD_HELD', 'The applicable reporting window remains open.');
      }
      await caps(award.owner, award.pairKey, award.kind, 'finalizedAt', at, tx);
      await Award.updateOne({ _id: award._id, status: 'pending' }, { $set: { status: 'finalized', finalizedAt: at } }, { session: tx });
      await writeLedger(award, at, tx); return { ...award, status: 'finalized', finalizedAt: at };
    });
  }
  async function holdTutoring(awardId, actorId, reason, release = false) {
    const initial = await awardContext(awardId); actorId = id(actorId); reason = note(reason);
    return transaction([initial.owner, initial.learner, actorId].filter(Boolean), async (tx, users) => {
      const award = await Award.findById(initial._id).session(tx).lean();
      const actor = staff(users.get(actorId), award);
      if (award.kind !== 'verified_tutoring' || award.status !== (release ? 'held' : 'pending')) fail('EXP_STATE_CONFLICT', 'Only a pending tutoring award can be held; only a held award can be released.');
      const status = release ? 'pending' : 'held';
      await Award.updateOne({ _id: award._id }, { $set: { status, holdReason: reason, holdActor: actorId } }, { session: tx });
      await recordAudit({ actor, action: release ? ACTIONS.expReleased : ACTIONS.expHeld, targetType: 'ExpAward', targetId: award._id,
        summary: release ? 'Tutoring EXP hold released; source revalidation still required' : 'Tutoring EXP held for report review', metadata: { reason }, session: tx });
      return { ...award, status };
    });
  }
  async function reverseAward(ledgerId, actorId, reason) {
    ledgerId = id(ledgerId); actorId = id(actorId); reason = note(reason);
    const initial = await Ledger.findById(ledgerId).lean();
    if (!initial?.award || initial.kind === 'reversal') fail('EXP_ORIGINAL_REQUIRED', 'An original engine award is required.');
    const claim = await awardContext(String(initial.award));
    return transaction([initial.owner, claim.learner, actorId].filter(Boolean), async (tx, users, at) => {
      const original = await Ledger.findById(ledgerId).session(tx).lean();
      const award = await Award.findById(original.award).session(tx).lean();
      const actor = staff(users.get(actorId), award, true);
      const existing = await Ledger.findOne({ reversalOf: original._id }).session(tx).lean();
      if (existing) return existing;
      if (award.status !== 'finalized' || !same(award.owner, original.owner) || award.amount !== original.delta
        || award.kind !== original.kind || !same(award.sourceId, original.sourceId)
        || award.eventKey !== original.eventKey || award.policy.version !== original.policyVersion) {
        fail('EXP_ORIGINAL_REQUIRED', 'Award and ledger evidence do not match.');
      }
      const reversal = correctionEntry(original, users.get(actorId), reason);
      const [entry] = await Ledger.create([{ ...reversal, policyVersion: award.policy.version, award: award._id, createdAt: at }], { session: tx });
      await Award.updateOne({ _id: award._id }, { $set: { status: 'reversed', reversedAt: at } }, { session: tx });
      await recordAudit({ actor, action: ACTIONS.expReversed, targetType: 'ExpLedgerEntry', targetId: entry._id,
        summary: 'EXP reversed by an independent Administrator', metadata: { reason, amount: entry.delta, reference: String(original._id) }, session: tx });
      return entry.toObject();
    });
  }
  return Object.freeze({ awardAssessment, queueTutoring, finalizeTutoring,
    holdTutoring: (award, actor, reason) => holdTutoring(award, actor, reason),
    releaseTutoringHold: (award, actor, reason) => holdTutoring(award, actor, reason, true), reverseAward });
}

// This is an explicit isolated-test capability, not an activation switch. No route imports it.
async function createIsolatedExpEngine({ clock = () => new Date() } = {}) {
  const connection = mongoose.connection;
  if (process.env.NODE_ENV !== 'test' || connection.readyState !== 1 || connection.host !== '127.0.0.1'
    || connection.port !== 27032 || !/^acadova_exp_engine_test_[a-f0-9]{32}$/.test(connection.name)) {
    fail('EXP_ISOLATED_TEST_ONLY', 'An explicit isolated loopback EXP replica set is required.', 503);
  }
  const hello = await connection.db.admin().command({ hello: 1 });
  if (hello.setName !== 'acadovaExpQA' || hello.hosts?.length !== 1 || hello.hosts[0] !== '127.0.0.1:27032') {
    fail('EXP_ISOLATED_TEST_ONLY', 'Unexpected replica-set topology.', 503);
  }
  await assertIndexes();
  return engine(clock, expEnginePolicy());
}
// Internal server adapters only. Actor IDs must come from authenticated server context,
// never request bodies. The constant hard-off gate runs before policy or database work.
const gated = method => async (...args) => {
  requireExpActivation();
  const p=expEnginePolicy();
  const policy={...p,version:'student-free-exp-1',minimumMinutes:Math.max(15,p.minimumMinutes),reportWindowHours:Math.max(48,p.reportWindowHours),tutoringDaily:Math.min(2,p.tutoringDaily),tutoringWeekly:Math.min(8,p.tutoringWeekly),pairDaily:Math.min(1,p.pairDaily),pairWeekly:Math.min(2,p.pairWeekly)};
  return engine(() => new Date(), policy, true)[method](...args);
};
module.exports = { awardAssessment: gated('awardAssessment'), queueTutoring: gated('queueTutoring'),
  finalizeTutoring: gated('finalizeTutoring'), holdTutoring: gated('holdTutoring'),
  releaseTutoringHold: gated('releaseTutoringHold'), reverseAward: gated('reverseAward'), createIsolatedExpEngine, utcWindows };
