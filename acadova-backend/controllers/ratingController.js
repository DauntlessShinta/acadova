const Session = require('../models/Session');
const Rating = require('../models/Rating');
const User = require('../models/User');
const { isValidObjectId, isValidRating } = require('../middleware/validation');

// A participant rates the other party after a session is completed.
exports.submitRating = async (req, res) => {
  try {
    const { sessionId, rating, comment } = req.body;

    if (!isValidObjectId(sessionId)) {
      return res.status(400).json({ success: false, message: 'Invalid session id' });
    }
    if (!isValidRating(rating)) {
      return res.status(400).json({ success: false, message: 'Rating must be an integer from 1 to 5' });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    if (session.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'You can only rate completed sessions' });
    }

    const isLearner = session.learner.toString() === req.user.id;
    const isTutor = session.tutor.toString() === req.user.id;
    if (!isLearner && !isTutor) {
      return res.status(403).json({ success: false, message: 'You are not part of this session' });
    }

    const toUser = isLearner ? session.tutor : session.learner;

    const existing = await Rating.findOne({ session: sessionId, fromUser: req.user.id });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You already rated this session' });
    }

    const newRating = await Rating.create({
      session: sessionId,
      fromUser: req.user.id,
      toUser,
      rating,
      comment,
    });

    await recalculateAverageRating(toUser);

    res.status(201).json({ success: true, message: 'Rating submitted', data: newRating });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'You already rated this session' });
    }
    res.status(500).json({ success: false, message: 'Server error while submitting rating' });
  }
};

// Recomputes a user's average rating from all ratings they have received.
async function recalculateAverageRating(userId) {
  const stats = await Rating.aggregate([
    { $match: { toUser: userId } },
    { $group: { _id: '$toUser', average: { $avg: '$rating' } } },
  ]);
  const average = stats.length ? stats[0].average : 5.0;
  await User.findByIdAndUpdate(userId, { rating: average });
}
