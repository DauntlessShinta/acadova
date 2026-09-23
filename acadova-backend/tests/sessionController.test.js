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
  sessionCreate: Session.create,
  messageFind: SessionMessage.find,
  messageCreate: SessionMessage.create,
  userFindById: User.findById,
  userFindOneAndUpdate: User.findOneAndUpdate,
  transactionFindOne: CreditTransaction.findOne,
  transactionCreate: CreditTransaction.create,
  ratingFindOne: Rating.findOne,
  ratingCreate: Rating.create,
  ratingAggregate: Rating.aggregate,
  userFindByIdAndUpdate: User.findByIdAndUpdate,
  startSession: mongoose.startSession,
};

test.afterEach(() => {
  Session.findById = originals.sessionFindById;
  Session.create = originals.sessionCreate;
  SessionMessage.find = originals.messageFind;
  SessionMessage.create = originals.messageCreate;
  User.findById = originals.userFindById;
  User.findOneAndUpdate = originals.userFindOneAndUpdate;
  CreditTransaction.findOne = originals.transactionFindOne;
  CreditTransaction.create = originals.transactionCreate;
  Rating.findOne = originals.ratingFindOne;
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
  ...overrides,
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

  await controller.getSessionById({
    params: { id: session._id },
    user: { id: '507f1f77bcf86cd799439099' },
  }, res);

  assert.equal(res.statusCode, 403);
});

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
  CreditTransaction.findOne = () => ({ session: async () => null });
  User.findById = () => ({ session: async () => learner });
  User.findOneAndUpdate = async (query, update) => {
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
