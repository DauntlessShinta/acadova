const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const Rating = require('../models/Rating');
const { getUserReviews } = require('../controllers/userController');

test('peer reviews expose only visible review fields and require a Student profile', async (t) => {
  const originalExists = User.exists;
  const originalFind = Rating.find;
  t.after(() => { User.exists = originalExists; Rating.find = originalFind; });
  const peerId = '507f1f77bcf86cd799439011';
  let filter;
  User.exists = async (query) => {
    assert.deepEqual(query, { _id: peerId, role: 'student', suspendedAt: null, emailVerified: { $ne: false } });
    return true;
  };
  Rating.find = (query) => {
    filter = query;
    const chain = { select: () => chain, populate: () => chain, sort: () => chain,
      limit: () => chain, lean: async () => [{ _id: peerId, rating: 5,
        comment: 'Helpful', fromUser: { name: 'A peer', email: 'private@example.test' },
        session: 'private-session' }] };
    return chain;
  };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
  await getUserReviews({ params: { id: peerId } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(filter, { toUser: peerId, isHidden: { $ne: true } });
  assert.deepEqual(res.body.data, [{ id: peerId, rating: 5,
    comment: 'Helpful', reviewerName: 'A peer', createdAt: undefined }]);
  User.exists = async () => false;
  await getUserReviews({ params: { id: peerId } }, res);
  assert.equal(res.statusCode, 404);
});
