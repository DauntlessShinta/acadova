const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Ledger = require('../models/ExpLedgerEntry');
const { assessmentEvent, tutoringEvent, withinTutoringCaps, requireExpActivation, correctionEntry, growthStatus } = require('../services/growthFoundation');
const { evaluateCutover, requiredCutoverEvidence } = require('../config/growthPolicy');
const owner = new mongoose.Types.ObjectId();
const source = new mongoose.Types.ObjectId();

test('partial and even complete readiness evidence cannot activate a partial economic cutover', () => {
  assert.equal(evaluateCutover().ready, false);
  assert.equal(evaluateCutover({ transactionsVerified: true }).ready, false);
  const ready = evaluateCutover(Object.fromEntries(requiredCutoverEvidence.map(key => [key, true])));
  assert.equal(ready.ready, true);
  assert.equal(ready.active, false);
  assert.throws(requireExpActivation, { code: 'EXP_NOT_ACTIVE', status: 503 });
  assert.equal(growthStatus().totalExp, null);
  assert.equal(growthStatus().active, false);
});

test('official assessment eligibility is owner-bound, passed, published and first-milestone keyed', () => {
  const assessment = { _id: source, status: 'published' };
  const attempt = { _id: new mongoose.Types.ObjectId(), student: owner, assessment: source, passed: true, mode: 'official', submittedAt: new Date() };
  assert.equal(assessmentEvent(owner, attempt, assessment).eventKey, `assessment:${source}`);
  assert.equal(assessmentEvent(owner, { ...attempt, mode: 'practice' }, assessment), null);
  assert.equal(assessmentEvent(owner, { ...attempt, passed: false }, assessment), null);
  assert.equal(assessmentEvent(new mongoose.Types.ObjectId(), attempt, assessment), null);
  assert.equal(assessmentEvent(owner, attempt, { ...assessment, status: 'draft' }), null);
});

test('tutoring eligibility requires canonical, ordered mutual evidence and rejects disputes, self-awards and legacy completion', () => {
  const session = { _id: source, tutor: owner, learner: new mongoose.Types.ObjectId(), lifecycleVersion: 1, status: 'completed' };
  ['scheduledAt', 'learnerCheckedInAt', 'tutorCheckedInAt', 'startedAt', 'awaitingValidationAt', 'learnerConfirmedAt', 'tutorConfirmedAt', 'completedAt'].forEach((key, i) => { session[key] = new Date(100000 + i * 1000); });
  assert.equal(tutoringEvent(owner, session).eventKey, `session:${source}`);
  for (const change of [{ tutorConfirmedAt: null }, { status: 'awaiting_validation' }, { lifecycleVersion: undefined },
    { learner: owner }, { disputedAt: new Date() }, { reviewIndicators: ['suspicious'] }, { completedAt: new Date(1) }]) {
    assert.equal(tutoringEvent(owner, { ...session, ...change }), null);
  }
  assert.equal(tutoringEvent(session.learner, session), null);
});

test('tutoring safeguards refuse repeated pairs, daily/weekly caps and invalid counters', () => {
  assert.equal(withinTutoringCaps({ earnedToday: 1, earnedThisWeek: 7, pairSubjectAwardsToday: 0 }), true);
  for (const values of [{ earnedToday: 2, earnedThisWeek: 2, pairSubjectAwardsToday: 0 },
    { earnedToday: 1, earnedThisWeek: 8, pairSubjectAwardsToday: 0 },
    { earnedToday: 0, earnedThisWeek: 0, pairSubjectAwardsToday: 1 },
    { earnedToday: -1, earnedThisWeek: 0, pairSubjectAwardsToday: 0 }]) assert.equal(withinTutoringCaps(values), false);
});

test('ledger uses unique owner-event and reversal indexes and never auto-creates indexes', async () => {
  assert.equal(Ledger.schema.options.autoIndex, false);
  assert.equal(Ledger.schema.options.autoCreate, false);
  const indexes = Ledger.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => keys.owner === 1 && keys.eventKey === 1 && options.unique));
  assert.ok(indexes.some(([keys, options]) => keys.reversalOf === 1 && options.unique));
  const base = { owner, sourceId: source, eventKey: `assessment:${source}`, kind: 'official_assessment', delta: 20, reason: 'First official milestone', policyVersion: 'exp-foundation-1' };
  assert.equal(new Ledger(base).validateSync(), undefined);
  assert.ok(new Ledger({ ...base, delta: 0 }).validateSync());
  assert.ok(new Ledger({ ...base, delta: -20 }).validateSync());
  assert.ok(new Ledger({ ...base, kind: 'reversal', delta: -20 }).validateSync());
  await assert.rejects(Ledger.updateOne({ owner }, { $set: { delta: 100 } }).exec(), /append-only/);
  await assert.rejects(Ledger.deleteMany({ owner }).exec(), /append-only/);
  await assert.rejects(new Ledger(base).deleteOne(), /append-only/);
  await assert.rejects(Ledger.bulkWrite([{ deleteOne: { filter: { owner } } }]), /append-only/);
  await assert.rejects(Ledger.bulkWrite([{ updateOne: { filter: { owner }, update: { $set: { delta: 100 } } } }]), /append-only/);
});

test('correction preparation is independent, append-only and cannot invent or partially reverse an award', () => {
  const original = { _id: source, owner, sourceId: source, kind: 'official_assessment', delta: 20 };
  const actor = { _id: new mongoose.Types.ObjectId(), role: 'admin', emailVerified: true };
  const correction = correctionEntry(original, actor, 'Invalid milestone evidence confirmed');
  assert.equal(correction.delta, -20); assert.equal(original.delta, 20);
  assert.equal(correction.reversalOf, source); assert.equal(correction.actor, actor._id);
  assert.equal(correction.eventKey, `reversal:${source}`);
  assert.throws(() => correctionEntry(original, { ...actor, _id: owner }, 'A conflict of interest'), { status: 403 });
  assert.throws(() => correctionEntry(original, { ...actor, role: 'student' }, 'Not an authorized correction'), { status: 403 });
  assert.throws(() => correctionEntry({ ...original, kind: 'reversal' }, actor, 'Cannot reverse a reversal'), { status: 403 });
  assert.throws(() => correctionEntry(original, actor, 'short'), { status: 403 });
});
