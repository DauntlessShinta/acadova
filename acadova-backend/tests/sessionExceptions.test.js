const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Session = require('../models/Session');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const Rating = require('../models/Rating');
const AuditLog = require('../models/AuditLog');
const sessionController = require('../controllers/sessionController');
const moderatorController = require('../controllers/moderatorController');
const ratingController = require('../controllers/ratingController');
const { isSessionRatingEligible, classifyLegacySession } = require('../utils/sessionLifecycleCompatibility');

const originals = {
  findById: Session.findById, findOneAndUpdate: Session.findOneAndUpdate,
  updateOne: Session.updateOne, find: Session.find,
  exists: CreditTransaction.exists, findOne: CreditTransaction.findOne,
  create: CreditTransaction.create, userFindById: User.findById,
  userFindOneAndUpdate: User.findOneAndUpdate, userFindByIdAndUpdate: User.findByIdAndUpdate,
  ratingFindOne: Rating.findOne, ratingCreate: Rating.create, ratingAggregate: Rating.aggregate,
  transactionFind: CreditTransaction.find, startSession: mongoose.startSession,
  auditCreate: AuditLog.create,
};
test.afterEach(() => {
  Session.findById = originals.findById;
  Session.findOneAndUpdate = originals.findOneAndUpdate;
  Session.updateOne = originals.updateOne;
  Session.find = originals.find;
  CreditTransaction.exists = originals.exists;
  CreditTransaction.findOne = originals.findOne;
  CreditTransaction.create = originals.create;
  CreditTransaction.find = originals.transactionFind;
  User.findById = originals.userFindById;
  User.findOneAndUpdate = originals.userFindOneAndUpdate;
  User.findByIdAndUpdate = originals.userFindByIdAndUpdate;
  Rating.findOne = originals.ratingFindOne;
  Rating.create = originals.ratingCreate;
  Rating.aggregate = originals.ratingAggregate;
  mongoose.startSession = originals.startSession;
  AuditLog.create = originals.auditCreate;
});

const ids = {
  session: '507f1f77bcf86cd799439011', learner: '507f1f77bcf86cd799439012',
  tutor: '507f1f77bcf86cd799439013', outsider: '507f1f77bcf86cd799439014',
  moderator: '507f1f77bcf86cd799439015',
};
const response = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const doc = (overrides = {}) => ({
  _id: ids.session, learner: ids.learner, tutor: ids.tutor,
  subject: 'Python', creditAmount: 2, status: 'accepted',
  scheduledAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  async populate() {}, toObject() { return { ...this }; }, ...overrides,
});
const awaitingEvidence = {
  status: 'awaiting_validation',
  startedAt: new Date('2026-09-25T06:30:00.000Z'),
  learnerCheckedInAt: new Date('2026-09-25T06:29:00.000Z'),
  tutorCheckedInAt: new Date('2026-09-25T06:30:00.000Z'),
  awaitingValidationAt: new Date('2026-09-25T07:30:00.000Z'),
};
const equalValue = (a, b) => a instanceof Date || b instanceof Date
  ? new Date(a).getTime() === new Date(b).getTime() : String(a) === String(b);
const matches = (stored, filter) => Object.entries(filter).every(([key, value]) => (
  value === null ? stored[key] == null : equalValue(stored[key], value)
));
const invoke = async (handler, stored, actor, body = {}) => {
  const res = response();
  await handler({ params: { id: stored._id }, user: { id: actor, role: 'moderator' }, body }, res);
  return res;
};
const noShowStore = (overrides = {}) => {
  const stored = doc(overrides);
  Session.findById = async () => doc({ ...stored });
  Session.findOneAndUpdate = async (filter, update) => {
    if (!matches(stored, filter)) return null;
    Object.assign(stored, update.$set);
    return stored;
  };
  CreditTransaction.exists = async () => null;
  return stored;
};

test('no-show requires elapsed check-in window and a participant', async () => {
  const stored = noShowStore({ scheduledAt: new Date(Date.now() - 3 * 60 * 60 * 1000) });
  assert.equal((await invoke(sessionController.reportNoShow, stored, ids.learner)).statusCode, 400);
  assert.equal((await invoke(sessionController.reportNoShow, stored, ids.outsider)).statusCode, 403);
  assert.equal(stored.status, 'accepted');
});

for (const [evidence, absent] of [
  [{ learnerCheckedInAt: new Date(Date.now() - 5 * 60 * 60 * 1000) }, 'tutor'],
  [{ tutorCheckedInAt: new Date(Date.now() - 5 * 60 * 60 * 1000) }, 'learner'],
  [{}, 'both'],
]) {
  test(`no-show derives ${absent} absence from stored evidence without credits`, async () => {
    const stored = noShowStore({ status: 'scheduled', ...evidence });
    CreditTransaction.create = async () => assert.fail('No-show must not settle credits');
    const result = await invoke(sessionController.reportNoShow, stored, ids.learner);
    assert.equal(result.statusCode, 200);
    assert.equal(stored.status, 'no_show');
    assert.equal(stored.noShowAbsent, absent);
    assert.equal(stored.noShowReportedBy, ids.learner);
    assert.ok(stored.noShowAt instanceof Date);
    assert.equal(isSessionRatingEligible(stored), false);
    assert.equal((await invoke(sessionController.reportNoShow, stored, ids.tutor)).statusCode, 400);
  });
}

test('no-show rejects completed, in-progress, awaiting-validation, proposals and both-present records', async () => {
  const stored = noShowStore();
  for (const status of ['pending', 'completed', 'cancelled', 'declined', 'rejected', 'in_progress', 'awaiting_validation']) {
    stored.status = status;
    assert.equal((await invoke(sessionController.reportNoShow, stored, ids.learner)).statusCode, 400, status);
  }
  stored.status = 'accepted';
  stored.rescheduleProposalId = 'active';
  assert.equal((await invoke(sessionController.reportNoShow, stored, ids.learner)).statusCode, 409);
  delete stored.rescheduleProposalId;
  stored.learnerCheckedInAt = new Date();
  stored.tutorCheckedInAt = new Date();
  assert.equal((await invoke(sessionController.reportNoShow, stored, ids.learner)).statusCode, 409);
});

test('stale no-show loses a race with status change', async () => {
  const stored = noShowStore();
  Session.findOneAndUpdate = async () => { stored.status = 'cancelled'; return null; };
  assert.equal((await invoke(sessionController.reportNoShow, stored, ids.learner)).statusCode, 409);
  assert.equal(stored.noShowAt, undefined);
});

test('dispute needs an eligible participant and bounded reason', async () => {
  const stored = noShowStore(awaitingEvidence);
  assert.equal((await invoke(sessionController.disputeSession, stored, ids.outsider, { reason: 'The tutor was absent.' })).statusCode, 403);
  assert.equal((await invoke(sessionController.disputeSession, stored, ids.learner, { reason: 'short' })).statusCode, 400);
  for (const status of ['pending', 'scheduled', 'completed', 'in_progress']) {
    stored.status = status;
    assert.equal((await invoke(sessionController.disputeSession, stored, ids.learner, { reason: 'This did not happen.' })).statusCode, 400);
  }
  stored.status = 'awaiting_validation';
  CreditTransaction.exists = async () => true;
  assert.equal((await invoke(sessionController.disputeSession, stored, ids.learner, { reason: 'This did not happen.' })).statusCode, 409);
});

test('dispute preserves a prior confirmation, blocks duplicate and transfers no credits', async () => {
  const prior = new Date();
  const stored = noShowStore({ ...awaitingEvidence, learnerConfirmedAt: prior });
  CreditTransaction.create = async () => assert.fail('Dispute must not settle credits');
  const result = await invoke(sessionController.disputeSession, stored, ids.tutor, { reason: 'We did not finish the topic.' });
  assert.equal(result.statusCode, 200);
  assert.equal(stored.status, 'disputed');
  assert.equal(stored.learnerConfirmedAt, prior);
  assert.equal(stored.tutorConfirmedAt, undefined);
  assert.equal(stored.disputedBy, ids.tutor);
  assert.equal(stored.disputeReason, 'We did not finish the topic.');
  assert.equal(isSessionRatingEligible(stored), false);
  assert.equal((await invoke(sessionController.disputeSession, stored, ids.learner, { reason: 'Different reason here.' })).statusCode, 400);
  mongoose.startSession = async () => ({ async withTransaction(callback) { await callback(); }, async endSession() {} });
  Session.findById = () => ({ session: async () => doc({ ...stored }) });
  assert.equal((await invoke(sessionController.confirmSession, stored, ids.tutor)).statusCode, 409);
});

test('dispute loses an atomic race with final confirmation', async () => {
  const stored = noShowStore(awaitingEvidence);
  Session.findOneAndUpdate = async () => { stored.status = 'completed'; return null; };
  const result = await invoke(sessionController.disputeSession, stored, ids.learner, { reason: 'The interaction was incomplete.' });
  assert.equal(result.statusCode, 409);
  assert.equal(stored.disputedAt, undefined);
});

test('no-show may be disputed without inventing attendance evidence', async () => {
  const stored = noShowStore({ status: 'no_show', noShowAt: new Date(), noShowAbsent: 'both' });
  const result = await invoke(sessionController.disputeSession, stored, ids.learner, { reason: 'We met outside the app.' });
  assert.equal(result.statusCode, 200);
  assert.equal(stored.noShowAbsent, 'both');
  assert.equal(stored.status, 'disputed');
});

const resolutionStore = (overrides = {}, initialCredits = 5) => {
  AuditLog.create = async ([entry]) => [entry];
  const stored = doc({
    ...awaitingEvidence, status: 'disputed', disputedAt: new Date(), disputedBy: ids.learner,
    disputeReason: 'The lesson did not happen.', ...overrides,
  });
  const learner = { credits: initialCredits, async save() {} };
  let tutorCredits = 0;
  let payments = [];
  let queue = Promise.resolve();
  let failLedger = false;
  mongoose.startSession = async () => ({
    async withTransaction(callback) {
      const previous = queue;
      let release;
      queue = new Promise((resolve) => { release = resolve; });
      await previous;
      const before = { ...stored };
      const learnerBefore = learner.credits;
      const tutorBefore = tutorCredits;
      const paymentsBefore = [...payments];
      try { await callback(); } catch (error) {
        for (const key of Object.keys(stored)) if (!Object.hasOwn(before, key)) delete stored[key];
        Object.assign(stored, before);
        learner.credits = learnerBefore;
        tutorCredits = tutorBefore;
        payments = paymentsBefore;
        throw error;
      } finally { release(); }
    },
    async endSession() {},
  });
  Session.findById = () => ({ session: async () => doc({ ...stored }) });
  Session.updateOne = async (filter, update) => {
    if (!matches(stored, filter)) return { matchedCount: 0 };
    Object.assign(stored, update.$set);
    return { matchedCount: 1 };
  };
  CreditTransaction.findOne = () => ({ session: async () => payments[0] || null });
  CreditTransaction.create = async ([row]) => {
    if (failLedger) throw new Error('Ledger unavailable');
    payments.push({ ...row, type: 'session_payment' });
  };
  User.findById = () => ({ session: async () => learner });
  User.findOneAndUpdate = async (filter, update) => {
    if (String(filter._id) === String(stored.learner)) {
      if (learner.credits < filter.credits.$gte) return null;
      learner.credits += update.$inc.credits;
      return learner;
    }
    tutorCredits += update.$inc.credits;
    return { _id: ids.tutor };
  };
  return {
    stored, learner,
    get tutorCredits() { return tutorCredits; },
    get payments() { return payments; },
    setFailLedger(value) { failLedger = value; },
  };
};
const resolve = (stored, outcome = 'confirm_session', actor = ids.moderator) => invoke(
  moderatorController.resolveSessionDispute, stored, actor,
  { resolution: outcome, resolutionNote: 'Reviewed the attendance evidence.' }
);

test('Moderator valid resolution settles once and becomes rating-eligible', async () => {
  const state = resolutionStore();
  const result = await resolve(state.stored);
  assert.equal(result.statusCode, 200);
  assert.equal(state.stored.status, 'resolved');
  assert.equal(state.stored.resolution, 'confirm_session');
  assert.equal(state.stored.resolvedBy, ids.moderator);
  assert.ok(state.stored.resolvedAt instanceof Date);
  assert.ok(state.stored.completedAt instanceof Date);
  assert.ok(state.stored.creditsSettledAt instanceof Date);
  assert.equal(state.stored.confirmedAt, undefined);
  assert.equal(state.learner.credits, 3);
  assert.equal(state.tutorCredits, 2);
  assert.equal(state.payments.length, 1);
  assert.equal(isSessionRatingEligible(state.stored, state.payments), true);
  assert.equal(isSessionRatingEligible({ ...state.stored, resolutionNote: undefined }, state.payments), false);
  assert.equal(classifyLegacySession(state.stored, state.payments).settlementState, 'settled');
  assert.equal((await resolve(state.stored)).statusCode, 409);
  assert.equal(state.payments.length, 1);
});

test('Moderator invalid resolution stores audit metadata without settlement or rating', async () => {
  const state = resolutionStore();
  const result = await resolve(state.stored, 'cancel_session');
  assert.equal(result.statusCode, 200);
  assert.equal(state.stored.status, 'resolved');
  assert.equal(state.stored.resolution, 'cancel_session');
  assert.equal(state.stored.resolutionNote, 'Reviewed the attendance evidence.');
  assert.equal(state.stored.creditsSettledAt, undefined);
  assert.equal(state.payments.length, 0);
  assert.equal(state.learner.credits, 5);
  assert.equal(state.tutorCredits, 0);
  assert.equal(isSessionRatingEligible(state.stored, state.payments), false);
});

test('disputed no-show may be confirmed by Moderator with explicit outcome and settlement', async () => {
  const state = resolutionStore({
    awaitingValidationAt: undefined, startedAt: undefined,
    learnerCheckedInAt: undefined, tutorCheckedInAt: undefined,
    noShowAt: new Date(), noShowAbsent: 'both',
  });
  assert.equal((await resolve(state.stored)).statusCode, 200);
  assert.equal(state.stored.status, 'resolved');
  assert.equal(state.stored.noShowAbsent, 'both');
  assert.equal(state.payments.length, 1);
  assert.equal(isSessionRatingEligible(state.stored, state.payments), true);
});

test('simultaneous Moderator resolutions settle once', async () => {
  const state = resolutionStore();
  const results = await Promise.all([resolve(state.stored), resolve(state.stored)]);
  assert.deepEqual(results.map((item) => item.statusCode).sort(), [200, 409]);
  assert.equal(state.payments.length, 1);
  assert.equal(state.learner.credits, 3);
  assert.equal(state.tutorCredits, 2);
});

test('insufficient credits and ledger failure roll back valid resolution', async () => {
  const low = resolutionStore({}, 1);
  assert.equal((await resolve(low.stored)).statusCode, 400);
  assert.equal(low.stored.status, 'disputed');
  assert.equal(low.stored.resolvedAt, undefined);
  assert.equal(low.learner.credits, 1);
  assert.equal(low.tutorCredits, 0);
  low.learner.credits = 3;
  assert.equal((await resolve(low.stored)).statusCode, 200);
  assert.equal(low.payments.length, 1);
  const failed = resolutionStore();
  failed.setFailLedger(true);
  assert.equal((await resolve(failed.stored)).statusCode, 500);
  assert.equal(failed.stored.status, 'disputed');
  assert.equal(failed.stored.creditsSettledAt, undefined);
  assert.equal(failed.learner.credits, 5);
  assert.equal(failed.tutorCredits, 0);
  assert.equal(failed.payments.length, 0);
});

test('pre-existing payment blocks either resolution outcome', async () => {
  const state = resolutionStore();
  CreditTransaction.findOne = () => ({ session: async () => ({ session: ids.session }) });
  assert.equal((await resolve(state.stored, 'confirm_session')).statusCode, 409);
  assert.equal((await resolve(state.stored, 'cancel_session')).statusCode, 409);
  assert.equal(state.stored.status, 'disputed');
});

test('audit failure rolls back Moderator dispute resolution and settlement', async () => {
  const state = resolutionStore();
  AuditLog.create = async () => { throw new Error('Audit storage unavailable'); };
  const result = await resolve(state.stored);
  assert.equal(result.statusCode, 500);
  assert.equal(state.stored.status, 'disputed');
  assert.equal(state.learner.credits, 5);
  assert.equal(state.tutorCredits, 0);
  assert.equal(state.payments.length, 0);
});

test('Moderator dispute list is restricted to disputed records', async () => {
  let filter;
  CreditTransaction.find = () => ({ select() { return this; }, lean: async () => [] });
  Session.find = (query) => {
    filter = query;
    return { populate() { return this; }, sort() { return this; }, limit: async () => [doc({ status: 'disputed' })] };
  };
  const res = response();
  await moderatorController.listDisputedSessions({}, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(filter, { status: 'disputed' });
  assert.equal(res.body.data.length, 1);
  assert.deepEqual(res.body.data[0].reviewIndicators, []);
  CreditTransaction.find = () => ({ select() { return this; }, lean: async () => [{ session: ids.session }] });
  const anomaly = response();
  await moderatorController.listDisputedSessions({}, anomaly);
  assert.deepEqual(anomaly.body.data[0].reviewIndicators, ['prior_credit_transaction']);
});

test('rating endpoint accepts only valid settled resolution, still rejecting duplicates and outsiders', async () => {
  const state = resolutionStore();
  assert.equal((await resolve(state.stored)).statusCode, 200);
  Session.findById = async () => doc({ ...state.stored });
  CreditTransaction.find = async () => state.payments;
  Rating.findOne = async () => null;
  Rating.create = async (data) => data;
  Rating.aggregate = async () => [];
  User.findByIdAndUpdate = async () => null;
  const rate = (actor) => invoke(ratingController.submitRating, state.stored, actor, {
    sessionId: ids.session, rating: 5, comment: 'Helpful session.',
  });
  assert.equal((await rate(ids.outsider)).statusCode, 403);
  assert.equal((await rate(ids.learner)).statusCode, 201);
  Rating.findOne = async () => ({ session: ids.session });
  assert.equal((await rate(ids.learner)).statusCode, 409);
  state.stored.resolution = 'cancel_session';
  assert.equal((await rate(ids.learner)).statusCode, 400);
});
