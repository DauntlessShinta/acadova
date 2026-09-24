const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Session = require('../models/Session');
const SessionMessage = require('../models/SessionMessage');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const Rating = require('../models/Rating');
const controller = require('../controllers/sessionController');
const ratingController = require('../controllers/ratingController');

const originals = {
  sessionFindById: Session.findById,
  sessionFindOneAndUpdate: Session.findOneAndUpdate,
  sessionUpdateOne: Session.updateOne,
  sessionCreate: Session.create,
  messageFind: SessionMessage.find,
  messageCreate: SessionMessage.create,
  userFindById: User.findById,
  userFindOneAndUpdate: User.findOneAndUpdate,
  transactionFindOne: CreditTransaction.findOne,
  transactionCreate: CreditTransaction.create,
  ratingFindOne: Rating.findOne,
  ratingExists: Rating.exists,
  ratingCreate: Rating.create,
  ratingAggregate: Rating.aggregate,
  userFindByIdAndUpdate: User.findByIdAndUpdate,
  startSession: mongoose.startSession,
};

test.afterEach(() => {
  Session.findById = originals.sessionFindById;
  Session.findOneAndUpdate = originals.sessionFindOneAndUpdate;
  Session.updateOne = originals.sessionUpdateOne;
  Session.create = originals.sessionCreate;
  SessionMessage.find = originals.messageFind;
  SessionMessage.create = originals.messageCreate;
  User.findById = originals.userFindById;
  User.findOneAndUpdate = originals.userFindOneAndUpdate;
  CreditTransaction.findOne = originals.transactionFindOne;
  CreditTransaction.create = originals.transactionCreate;
  Rating.findOne = originals.ratingFindOne;
  Rating.exists = originals.ratingExists;
  Rating.create = originals.ratingCreate;
  Rating.aggregate = originals.ratingAggregate;
  User.findByIdAndUpdate = originals.userFindByIdAndUpdate;
  mongoose.startSession = originals.startSession;
});

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const sessionDoc = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  learner: '507f1f77bcf86cd799439012',
  tutor: '507f1f77bcf86cd799439013',
  subject: 'Java',
  status: 'accepted',
  meetingMethod: 'online',
  meetingLink: 'https://meet.example.com/java',
  creditAmount: 1,
  async save() {},
  async populate() {},
  toObject() { return { ...this }; },
  ...overrides,
});

const mockAtomicSession = (session) => {
  Session.findOneAndUpdate = async (filter, update) => {
    if (String(filter._id) !== String(session._id) || filter.status !== session.status
      || (filter.meetingMethod !== undefined && filter.meetingMethod !== session.meetingMethod)) return null;
    Object.assign(session, update.$set);
    for (const field of Object.keys(update.$unset || {})) delete session[field];
    return session;
  };
};

test('a request to the exact or uppercase equivalent of the learner ID is rejected before lookup', async () => {
  const learnerId = '507f1f77bcf86cd799439abc';
  let lookups = 0;
  let creates = 0;
  User.findById = () => { lookups += 1; throw new Error('Self request must not look up a tutor'); };
  Session.create = async () => { creates += 1; };
  for (const tutorId of [learnerId, learnerId.toUpperCase()]) {
    const res = response();
    await controller.createSession({ user: { id: learnerId }, body: {
      tutorId, subject: 'Java', scheduledAt: '2026-09-25T06:30:00.000Z',
      meetingMethod: 'online', requestMessage: 'Help with arrays.', creditAmount: 1,
    } }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /yourself/);
  }
  assert.equal(lookups, 0);
  assert.equal(creates, 0);
});

test('learner cannot use the tutor completion transition', async () => {
  const session = sessionDoc();
  Session.findById = async () => session;
  const res = response();

  await controller.updateSessionStatus({
    params: { id: session._id },
    body: { status: 'completed' },
    user: { id: session.learner },
  }, res);

  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /Only the Tutor/);
  assert.equal(session.status, 'accepted');
});

test('acceptance changes status without creating a credit transaction', async () => {
  const session = sessionDoc({ status: 'pending' });
  let creditWrites = 0;
  Session.findById = async () => session;
  mockAtomicSession(session);
  CreditTransaction.create = async () => { creditWrites += 1; };
  const res = response();

  await controller.updateSessionStatus({
    params: { id: session._id },
    body: { status: 'accepted' },
    user: { id: session.tutor },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(session.status, 'accepted');
  assert.equal(creditWrites, 0);
});

test('tutor can mark an accepted coordinated session complete without moving credits', async () => {
  const session = sessionDoc();
  let creditWrites = 0;
  Session.findById = async () => session;
  mockAtomicSession(session);
  CreditTransaction.create = async () => { creditWrites += 1; };
  const res = response();

  await controller.updateSessionStatus({
    params: { id: session._id },
    body: { status: 'completed' },
    user: { id: session.tutor },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(session.status, 'completed');
  assert.ok(session.completedAt);
  assert.equal(session.confirmedAt, undefined);
  assert.equal(creditWrites, 0);
});

test('unrelated student cannot open the Session Room', async () => {
  const session = sessionDoc();
  Session.findById = async () => session;
  const res = response();
  Rating.exists = async () => assert.fail('Reviews must not be read before participant authorization');

  await controller.getSessionById({
    params: { id: session._id },
    user: { id: '507f1f77bcf86cd799439099' },
  }, res);

  assert.equal(res.statusCode, 403);
});

test('room refresh returns review state only for its current participant, including hidden reviews', async () => {
  const session = sessionDoc({ status: 'completed', confirmedAt: new Date(), creditsSettledAt: new Date() });
  Session.findById = async () => session;
  Rating.exists = async (query) => {
    assert.deepEqual(Object.keys(query).sort(), ['fromUser', 'session']);
    assert.equal(query.session, session._id);
    return query.fromUser === session.learner ? { _id: 'existing-hidden-review' } : null;
  };
  for (const author of [session.learner, session.tutor, session.learner]) {
    const res = response();
    await controller.getSessionById({ params: { id: session._id }, user: { id: author } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.myReview, author === session.learner);
  }
  assert.equal(session.myReview, undefined);
});

test('reading a legacy room does not save or backfill historical fields', async () => {
  const session = sessionDoc({ meetingMethod: undefined, meetingLink: undefined, scheduledAt: undefined,
    save: async () => assert.fail('A room read must not modify its session') });
  const before = JSON.stringify(session);
  Session.findById = async () => session;
  Rating.exists = async () => null;
  const res = response();
  await controller.getSessionById({ params: { id: session._id }, user: { id: session.learner } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.myReview, false);
  assert.equal(JSON.stringify(session), before);
});

test('review lookup failure is not reported as an unsubmitted review', async () => {
  const session = sessionDoc();
  Session.findById = async () => session;
  Rating.exists = async () => { throw new Error('lookup failed'); };
  const res = response();
  await controller.getSessionById({ params: { id: session._id }, user: { id: session.learner } }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.data, undefined);
});

for (const meetingMethod of ['online', 'in-person']) {
  test(`fresh ${meetingMethod} request preserves its UTC instant and supports coordination and messages`, async () => {
    const fixture = sessionDoc();
    let session;
    User.findById = () => ({ select: async () => ({ _id: fixture.tutor, role: 'student' }) });
    Session.create = async (data) => { session = sessionDoc({ ...data, status: 'pending', meetingLink: undefined }); return session; };
    const created = response();
    await controller.createSession({ user: { id: fixture.learner }, body: {
      tutorId: fixture.tutor, subject: 'Java demo', scheduledAt: '2026-09-25T06:30:00.000Z',
      meetingMethod, requestMessage: 'Please help with arrays.', creditAmount: 1,
    } }, created);
    assert.equal(created.statusCode, 201);
    assert.equal(session.scheduledAt.toISOString(), '2026-09-25T06:30:00.000Z');
    assert.equal(session.meetingMethod, meetingMethod);
    assert.equal(session.requestMessage, 'Please help with arrays.');
    Session.findById = async () => session;
    mockAtomicSession(session);
    const accepted = response();
    await controller.updateSessionStatus({ params: { id: session._id }, user: { id: fixture.tutor }, body: { status: 'accepted' } }, accepted);
    assert.equal(accepted.statusCode, 200);
    const details = meetingMethod === 'online' ? { meetingLink: 'https://meet.example.com/demo' } : { location: 'Library room 2' };
    const coordinated = response();
    await controller.updateCoordination({ params: { id: session._id }, user: { id: fixture.tutor }, body: details }, coordinated);
    assert.equal(coordinated.statusCode, 200);
    for (const [key, value] of Object.entries(details)) assert.equal(session[key], value);
    const messages = [];
    SessionMessage.create = async (data) => { const message = { ...data, _id: String(messages.length), async populate() {} }; messages.push(message); return message; };
    SessionMessage.find = () => ({ populate: () => ({ sort: async () => messages }) });
    for (const sender of [fixture.learner, fixture.tutor]) {
      const sent = response();
      await controller.createMessage({ params: { id: session._id }, user: { id: sender }, body: { body: 'Demo message' } }, sent);
      assert.equal(sent.statusCode, 201);
    }
    const received = response();
    await controller.getMessages({ params: { id: session._id }, user: { id: fixture.learner } }, received);
    assert.equal(received.body.data.length, 2);
  });
}

test('unrelated student cannot read session messages', async () => {
  const session = sessionDoc();
  Session.findById = async () => session;
  let messageReads = 0;
  SessionMessage.find = () => { messageReads += 1; };
  const res = response();

  await controller.getMessages({
    params: { id: session._id },
    user: { id: '507f1f77bcf86cd799439099' },
  }, res);

  assert.equal(res.statusCode, 403);
  assert.equal(messageReads, 0);
});

test('learner confirmation transfers the exact amount only once', async () => {
  const session = sessionDoc({ status: 'completed', creditAmount: 2 });
  const learner = { credits: 5, async save() {} };
  let tutorCredits = 0;
  let transactionWrites = 0;

  mongoose.startSession = async () => ({
    async withTransaction(callback) { await callback(); },
    async endSession() {},
  });
  Session.findById = () => ({ session: async () => session });
  Session.updateOne = async (filter, update) => {
    assert.equal(filter.status, 'completed');
    assert.equal(filter.confirmedAt, null);
    assert.equal(filter.creditsSettledAt, null);
    if (session.confirmedAt || session.creditsSettledAt) return { matchedCount: 0 };
    Object.assign(session, update.$set);
    return { matchedCount: 1 };
  };
  CreditTransaction.findOne = () => ({ session: async () => null });
  User.findById = () => ({ session: async () => learner });
  User.findOneAndUpdate = async (query, update) => {
    assert.ok(session.confirmedAt, 'The session must be claimed before balance updates');
    tutorCredits += update.$inc.credits;
    return { _id: query._id };
  };
  CreditTransaction.create = async (documents) => {
    transactionWrites += 1;
    assert.equal(documents[0].amount, 2);
  };

  const first = response();
  await controller.confirmSession({ params: { id: session._id }, user: { id: session.learner } }, first);
  assert.equal(first.statusCode, 200);
  assert.equal(learner.credits, 3);
  assert.equal(tutorCredits, 2);
  assert.equal(transactionWrites, 1);
  assert.ok(session.confirmedAt);
  assert.ok(session.creditsSettledAt);

  const repeated = response();
  await controller.confirmSession({ params: { id: session._id }, user: { id: session.learner } }, repeated);
  assert.equal(repeated.statusCode, 409);
  assert.equal(learner.credits, 3);
  assert.equal(tutorCredits, 2);
  assert.equal(transactionWrites, 1);
});

test('malformed historical self-session cannot move balances or create a ledger entry', async () => {
  const learnerId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439abc');
  const session = sessionDoc({
    learner: learnerId, tutor: new mongoose.Types.ObjectId(learnerId.toString()), status: 'completed',
  });
  let writes = 0;
  mongoose.startSession = async () => ({
    async withTransaction(callback) { await callback(); },
    async endSession() {},
  });
  Session.findById = () => ({ session: async () => session });
  Session.updateOne = async () => { writes += 1; throw new Error('Session must not change'); };
  User.findById = () => { writes += 1; throw new Error('Balance must not be read or changed'); };
  User.findOneAndUpdate = async () => { writes += 1; throw new Error('Tutor balance must not change'); };
  CreditTransaction.findOne = () => { writes += 1; throw new Error('Ledger must not be read or changed'); };
  CreditTransaction.create = async () => { writes += 1; throw new Error('Ledger must not be created'); };
  const res = response();
  await controller.confirmSession({ params: { id: session._id }, user: { id: learnerId.toString() } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /same learner and tutor/);
  assert.equal(writes, 0);
  assert.equal(session.confirmedAt, undefined);
});

test('competing learner confirmations claim one session and settle only once', async () => {
  const stored = sessionDoc({ status: 'completed', creditAmount: 1 });
  const learner = { credits: 3, async save() {} };
  let tutorCredits = 0;
  let ledgerWrites = 0;
  mongoose.startSession = async () => ({
    async withTransaction(callback) { await callback(); },
    async endSession() {},
  });
  Session.findById = () => ({ session: async () => sessionDoc({ ...stored }) });
  Session.updateOne = async (filter, update) => {
    assert.equal(filter.status, 'completed');
    if (stored.confirmedAt || stored.creditsSettledAt) return { matchedCount: 0 };
    Object.assign(stored, update.$set);
    return { matchedCount: 1 };
  };
  CreditTransaction.findOne = () => ({ session: async () => null });
  User.findById = () => ({ session: async () => learner });
  User.findOneAndUpdate = async () => { tutorCredits += 1; return { _id: stored.tutor }; };
  CreditTransaction.create = async () => { ledgerWrites += 1; };
  const first = response();
  const second = response();
  await Promise.all([
    controller.confirmSession({ params: { id: stored._id }, user: { id: stored.learner } }, first),
    controller.confirmSession({ params: { id: stored._id }, user: { id: stored.learner } }, second),
  ]);
  assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 409]);
  assert.equal(learner.credits, 2);
  assert.equal(tutorCredits, 1);
  assert.equal(ledgerWrites, 1);
});

test('explicit confirmation of an already-paid legacy session does not repeat its credit transfer', async () => {
  const stored = sessionDoc({ status: 'completed' });
  const priorPayment = { createdAt: new Date('2026-09-01T00:00:00.000Z') };
  let balanceWrites = 0;
  mongoose.startSession = async () => ({
    async withTransaction(callback) { await callback(); },
    async endSession() {},
  });
  Session.findById = () => ({ session: async () => stored });
  Session.updateOne = async (filter, update) => {
    assert.equal(filter.status, 'completed');
    Object.assign(stored, update.$set);
    return { matchedCount: 1 };
  };
  CreditTransaction.findOne = () => ({ session: async () => priorPayment });
  User.findById = () => { balanceWrites += 1; throw new Error('No new payment expected'); };
  User.findOneAndUpdate = async () => { balanceWrites += 1; throw new Error('No new payment expected'); };
  CreditTransaction.create = async () => { balanceWrites += 1; throw new Error('No new payment expected'); };
  const res = response();
  await controller.confirmSession({ params: { id: stored._id }, user: { id: stored.learner } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(balanceWrites, 0);
  assert.equal(stored.creditsSettledAt, priorPayment.createdAt);
});

test('pending requests can be declined and pending or accepted sessions can be cancelled', async () => {
  for (const [initial, next, actor] of [
    ['pending', 'rejected', 'tutor'], ['pending', 'cancelled', 'learner'],
    ['accepted', 'cancelled', 'tutor'],
  ]) {
    const session = sessionDoc({ status: initial });
    Session.findById = async () => session;
    mockAtomicSession(session);
    const res = response();
    await controller.updateSessionStatus({
      params: { id: session._id }, user: { id: session[actor] }, body: { status: next },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(session.status, next);
    assert.equal(session.completedAt, undefined);
  }
});

test('completion wins a stale cancellation race without inconsistent timestamps', async () => {
  const stored = sessionDoc();
  Session.findById = async () => sessionDoc({ ...stored });
  mockAtomicSession(stored);
  const atomicUpdate = Session.findOneAndUpdate;
  let reachedCancellation;
  let releaseCancellation;
  const cancellationReached = new Promise((resolve) => { reachedCancellation = resolve; });
  const cancellationReleased = new Promise((resolve) => { releaseCancellation = resolve; });
  Session.findOneAndUpdate = async (filter, update) => {
    if (update.$set.status === 'cancelled') {
      reachedCancellation();
      await cancellationReleased;
    }
    return atomicUpdate(filter, update);
  };
  const cancelled = response();
  const cancellation = controller.updateSessionStatus({
    params: { id: stored._id }, user: { id: stored.learner }, body: { status: 'cancelled' },
  }, cancelled);
  await cancellationReached;
  const completed = response();
  await controller.updateSessionStatus({
    params: { id: stored._id }, user: { id: stored.tutor }, body: { status: 'completed' },
  }, completed);
  releaseCancellation();
  await cancellation;
  assert.equal(completed.statusCode, 200);
  assert.equal(cancelled.statusCode, 409);
  assert.match(cancelled.body.message, /Refresh and try again/);
  assert.equal(stored.status, 'completed');
  assert.ok(stored.completedAt);
});

test('repeated completion and unrelated-user transitions are rejected', async () => {
  const stored = sessionDoc();
  Session.findById = async () => stored;
  mockAtomicSession(stored);
  const unrelated = response();
  await controller.updateSessionStatus({
    params: { id: stored._id }, user: { id: '507f1f77bcf86cd799439099' }, body: { status: 'completed' },
  }, unrelated);
  assert.equal(unrelated.statusCode, 403);
  const first = response();
  await controller.updateSessionStatus({
    params: { id: stored._id }, user: { id: stored.tutor }, body: { status: 'completed' },
  }, first);
  assert.equal(first.statusCode, 200);
  const repeated = response();
  await controller.updateSessionStatus({
    params: { id: stored._id }, user: { id: stored.tutor }, body: { status: 'completed' },
  }, repeated);
  assert.equal(repeated.statusCode, 400);
  assert.equal(stored.status, 'completed');
});

test('meeting details cannot be saved after a competing cancellation', async () => {
  const stored = sessionDoc();
  Session.findById = async () => sessionDoc({ ...stored });
  Session.findOneAndUpdate = async (filter) => {
    assert.equal(filter.status, 'accepted');
    stored.status = 'cancelled';
    return null;
  };
  const res = response();
  await controller.updateCoordination({
    params: { id: stored._id }, user: { id: stored.tutor },
    body: { meetingLink: 'https://meet.example.com/new' },
  }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(stored.meetingLink, 'https://meet.example.com/java');
});

test('new session requests require schedule, method, and request context', async () => {
  const res = response();
  await controller.createSession({
    body: {
      tutorId: '507f1f77bcf86cd799439013',
      subject: 'Java',
      creditAmount: 1,
    },
    user: { id: '507f1f77bcf86cd799439012' },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, 'Enter a preferred session date.');
});

test('rating stays locked until completion is confirmed and settled', async () => {
  const session = sessionDoc({ status: 'completed', completedAt: new Date() });
  Session.findById = async () => session;
  const res = response();

  await ratingController.submitRating({
    body: { sessionId: session._id, rating: 5 },
    user: { id: session.learner },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /after the Learner confirms/);
});

test('rating becomes available after confirmation and settlement', async () => {
  const session = sessionDoc({
    status: 'completed',
    completedAt: new Date(),
    confirmedAt: new Date(),
    creditsSettledAt: new Date(),
  });
  Session.findById = async () => session;
  Rating.findOne = async () => null;
  Rating.create = async (data) => ({ _id: 'rating-1', ...data });
  Rating.aggregate = async () => [{ average: 5 }];
  User.findByIdAndUpdate = async () => ({});
  const res = response();

  await ratingController.submitRating({
    body: { sessionId: session._id, rating: 5, comment: 'Clear explanation' },
    user: { id: session.learner },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.toUser, session.tutor);
});

test('malformed self-session cannot create a self-review', async () => {
  const learnerId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439abc');
  const session = sessionDoc({
    learner: learnerId, tutor: new mongoose.Types.ObjectId(learnerId.toString()),
    status: 'completed', confirmedAt: new Date(), creditsSettledAt: new Date(),
  });
  Session.findById = async () => session;
  let reviewWrites = 0;
  Rating.findOne = async () => { reviewWrites += 1; };
  Rating.create = async () => { reviewWrites += 1; };
  const res = response();
  await ratingController.submitRating({
    body: { sessionId: session._id, rating: 5 }, user: { id: learnerId.toString() },
  }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /cannot review yourself/);
  assert.equal(reviewWrites, 0);
});
