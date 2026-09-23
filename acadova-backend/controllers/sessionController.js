const mongoose = require('mongoose');
const Session = require('../models/Session');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const { isValidObjectId, isPositiveCreditAmount } = require('../middleware/validation');

// Legal session status transitions. Anything not listed here is rejected.
const ALLOWED_TRANSITIONS = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['completed', 'cancelled'],
  rejected: [],
  completed: [],
  cancelled: [],
};

// A learner requests a session with a tutor for a subject.
exports.createSession = async (req, res) => {
  try {
    const { tutorId, subject, scheduledAt, creditAmount } = req.body;

    if (!isValidObjectId(tutorId)) {
      return res.status(400).json({ success: false, message: 'Invalid tutor id' });
    }
    if (!subject || typeof subject !== 'string') {
      return res.status(400).json({ success: false, message: 'Subject is required' });
    }
    const amount = creditAmount === undefined ? 1 : creditAmount;
    if (!isPositiveCreditAmount(amount)) {
      return res.status(400).json({ success: false, message: 'Credit amount must be a positive number' });
    }
    if (tutorId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot request a session with yourself' });
    }

    const tutor = await User.findById(tutorId);
    if (!tutor) {
      return res.status(404).json({ success: false, message: 'Tutor not found' });
    }

    const session = await Session.create({
      learner: req.user.id,
      tutor: tutorId,
      subject,
      scheduledAt,
      creditAmount: amount,
    });
    await session.populate([
      { path: 'learner', select: 'name email' },
      { path: 'tutor', select: 'name email' },
    ]);

    res.status(201).json({ success: true, message: 'Session requested', data: session });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while creating session' });
  }
};

// Returns sessions where the current user is either the learner or the tutor.
exports.getMySessions = async (req, res) => {
  try {
    const sessions = await Session.find({
      $or: [{ learner: req.user.id }, { tutor: req.user.id }],
    })
      .populate('learner', 'name email')
      .populate('tutor', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, message: 'Sessions retrieved', data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while retrieving sessions' });
  }
};

// Transitions a session's status, enforcing ownership and valid state changes.
exports.updateSessionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid session id' });
    }

    const session = await Session.findById(id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const isLearner = session.learner.toString() === req.user.id;
    const isTutor = session.tutor.toString() === req.user.id;
    if (!isLearner && !isTutor) {
      return res.status(403).json({ success: false, message: 'You are not part of this session' });
    }

    if (!ALLOWED_TRANSITIONS[session.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change session from "${session.status}" to "${status}"`,
      });
    }

    // Only the tutor can accept or reject a request; either party can cancel.
    if ((status === 'accepted' || status === 'rejected') && !isTutor) {
      return res.status(403).json({ success: false, message: 'Only the tutor can accept or reject this session' });
    }

    if (status === 'completed') {
      try {
        await completeSessionWithCredits(session);
      } catch (error) {
        if (error.message === 'INSUFFICIENT_CREDITS') {
          return res.status(400).json({ success: false, message: 'Learner does not have enough credits' });
        }
        throw error;
      }
    } else {
      session.status = status;
      await session.save();
    }

    await session.populate([
      { path: 'learner', select: 'name email' },
      { path: 'tutor', select: 'name email' },
    ]);

    res.json({ success: true, message: 'Session updated', data: session });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while updating session' });
  }
};

// Moves credits from learner to tutor and records the transaction atomically.
async function completeSessionWithCredits(session) {
  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      const learner = await User.findById(session.learner).session(dbSession);
      if (!learner || learner.credits < session.creditAmount) {
        throw new Error('INSUFFICIENT_CREDITS');
      }

      learner.credits -= session.creditAmount;
      await learner.save({ session: dbSession });

      await User.updateOne(
        { _id: session.tutor },
        { $inc: { credits: session.creditAmount } },
        { session: dbSession }
      );

      session.status = 'completed';
      session.completedAt = new Date();
      await session.save({ session: dbSession });

      await CreditTransaction.create(
        [{ fromUser: session.learner, toUser: session.tutor, amount: session.creditAmount, session: session._id }],
        { session: dbSession }
      );
    });
  } finally {
    await dbSession.endSession();
  }
}
