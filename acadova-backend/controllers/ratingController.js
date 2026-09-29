const Session = require('../models/Session');
const Rating = require('../models/Rating');
const CreditTransaction = require('../models/CreditTransaction');
const { isValidObjectId, isValidRating } = require('../middleware/validation');
const { recalculateAverageRating } = require('../utils/ratingReputation');
const { isSessionRatingEligible } = require('../utils/sessionLifecycleCompatibility');

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
    if (String(session.learner).toLowerCase() === String(session.tutor).toLowerCase()) {
      return res.status(400).json({ success: false, message: 'You cannot review yourself.' });
    }
    const isLearner = session.learner.toString() === req.user.id;
    const isTutor = session.tutor.toString() === req.user.id;
    if (!isLearner && !isTutor) {
      return res.status(403).json({ success: false, message: 'You are not part of this session' });
    }

    if (session.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'You can rate this session after verified completion.' });
    }
    const transactions = await CreditTransaction.find({ session: session._id });
    if (!isSessionRatingEligible(session, transactions)) {
      return res.status(400).json({ success: false, message: 'You can rate this session after verified completion.' });
    }

    const toUser = isLearner ? session.tutor : session.learner;
    if (String(toUser).toLowerCase() === String(req.user.id).toLowerCase()) {
      return res.status(400).json({ success: false, message: 'You cannot review yourself.' });
    }

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
