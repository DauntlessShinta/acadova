const mongoose = require('mongoose');
const Session = require('../models/Session');
const SessionMessage = require('../models/SessionMessage');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const { isValidObjectId, isPositiveCreditAmount } = require('../middleware/validation');

const ALLOWED_TRANSITIONS = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['completed', 'cancelled'],
  rejected: [],
  completed: [],
  cancelled: [],
};

const SESSION_POPULATE = [
  { path: 'learner', select: 'name' },
  { path: 'tutor', select: 'name' },
];

const participantFlags = (session, userId) => ({
  isLearner: session.learner.toString() === userId,
  isTutor: session.tutor.toString() === userId,
});

const validateSessionId = (req, res) => {
  if (isValidObjectId(req.params.id)) return true;
  res.status(400).json({ success: false, message: 'Invalid session id.' });
  return false;
};

const findParticipantSession = async (req, res) => {
  if (!validateSessionId(req, res)) return null;
  const session = await Session.findById(req.params.id);
  if (!session) {
    res.status(404).json({ success: false, message: 'Session not found.' });
    return null;
  }
  const flags = participantFlags(session, req.user.id);
  if (!flags.isLearner && !flags.isTutor) {
    res.status(403).json({ success: false, message: 'You are not part of this session.' });
    return null;
  }
  return { session, ...flags };
};

const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

exports.createSession = async (req, res) => {
  try {
    const { tutorId, subject, scheduledAt, creditAmount, meetingMethod, requestMessage } = req.body;
    const cleanSubject = typeof subject === 'string' ? subject.trim() : '';
    const cleanMessage = typeof requestMessage === 'string' ? requestMessage.trim() : '';
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;

    if (!isValidObjectId(tutorId)) return res.status(400).json({ success: false, message: 'Choose a valid peer.' });
    if (!cleanSubject) return res.status(400).json({ success: false, message: 'Choose a subject.' });
    if (cleanSubject.length > 120) return res.status(400).json({ success: false, message: 'Subject must be 120 characters or fewer.' });
    if (!scheduledDate || Number.isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Enter a preferred session date.' });
    }
    if (!['online', 'in-person'].includes(meetingMethod)) {
      return res.status(400).json({ success: false, message: 'Choose a session method.' });
    }
    if (!cleanMessage) {
      return res.status(400).json({ success: false, message: 'Tell your peer what you would like help with.' });
    }
    if (cleanMessage.length > 500) {
      return res.status(400).json({ success: false, message: 'Your message must be 500 characters or fewer.' });
    }

    const amount = creditAmount === undefined ? 1 : creditAmount;
    if (!isPositiveCreditAmount(amount)) {
      return res.status(400).json({ success: false, message: 'Credit amount must be a positive number.' });
    }
    if (tutorId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot request a session with yourself.' });
    }

    const tutor = await User.findById(tutorId).select('_id role');
    if (!tutor || tutor.role !== 'student') {
      return res.status(404).json({ success: false, message: 'Peer student not found.' });
    }

    const session = await Session.create({
      learner: req.user.id,
      tutor: tutorId,
      subject: cleanSubject,
      scheduledAt: scheduledDate,
      meetingMethod,
      requestMessage: cleanMessage,
      creditAmount: amount,
    });
    await session.populate(SESSION_POPULATE);
    res.status(201).json({ success: true, message: 'Session requested.', data: session });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: 'Check the session details and try again.' });
    }
    res.status(500).json({ success: false, message: 'Session request could not be created.' });
  }
};

exports.getMySessions = async (req, res) => {
  try {
    const sessions = await Session.find({ $or: [{ learner: req.user.id }, { tutor: req.user.id }] })
      .populate(SESSION_POPULATE)
      .sort({ createdAt: -1 });
    res.json({ success: true, message: 'Sessions retrieved.', data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Sessions could not be loaded.' });
  }
};

exports.getSessionById = async (req, res) => {
  try {
    const result = await findParticipantSession(req, res);
    if (!result) return;
    await result.session.populate(SESSION_POPULATE);
    res.json({ success: true, message: 'Session retrieved.', data: result.session });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Session could not be loaded.' });
  }
};

exports.updateSessionStatus = async (req, res) => {
  try {
    const result = await findParticipantSession(req, res);
    if (!result) return;
    const { session, isTutor } = result;
    const { status } = req.body;

    if (!ALLOWED_TRANSITIONS[session.status]?.includes(status)) {
      return res.status(400).json({ success: false, message: `This session cannot move from ${session.status} to ${status}.` });
    }
    if ((status === 'accepted' || status === 'rejected') && !isTutor) {
      return res.status(403).json({ success: false, message: 'Only the Tutor can accept or decline this session.' });
    }
    if (status === 'completed' && !isTutor) {
      return res.status(403).json({ success: false, message: 'Only the Tutor can complete this session.' });
    }
    if (status === 'completed' && session.meetingMethod === 'online' && !session.meetingLink) {
      return res.status(400).json({ success: false, message: 'Add a meeting link before completing the online session.' });
    }
    if (status === 'completed' && session.meetingMethod === 'in-person' && !session.location) {
      return res.status(400).json({ success: false, message: 'Add a meeting location before completing the in-person session.' });
    }

    session.status = status;
    if (status === 'completed') session.completedAt = new Date();
    await session.save();
    await session.populate(SESSION_POPULATE);

    const message = status === 'completed'
      ? 'Session marked complete. Waiting for learner confirmation.'
      : status === 'accepted'
        ? 'Session accepted.'
        : status === 'rejected'
          ? 'Session declined.'
          : 'Session cancelled.';
    res.json({ success: true, message, data: session });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Session status could not be updated.' });
  }
};

exports.updateCoordination = async (req, res) => {
  try {
    const result = await findParticipantSession(req, res);
    if (!result) return;
    const { session, isTutor } = result;
    if (!isTutor) return res.status(403).json({ success: false, message: 'Only the Tutor can update meeting details.' });
    if (session.status !== 'accepted') {
      return res.status(400).json({ success: false, message: 'Meeting details can be updated after the session is accepted.' });
    }

    if (session.meetingMethod === 'online') {
      const meetingLink = typeof req.body.meetingLink === 'string' ? req.body.meetingLink.trim() : '';
      if (!meetingLink || !isHttpsUrl(meetingLink)) {
        return res.status(400).json({ success: false, message: 'Enter a valid HTTPS meeting link.' });
      }
      if (meetingLink.length > 500) return res.status(400).json({ success: false, message: 'Meeting link must be 500 characters or fewer.' });
      session.meetingLink = meetingLink;
      session.location = undefined;
    } else if (session.meetingMethod === 'in-person') {
      const location = typeof req.body.location === 'string' ? req.body.location.trim() : '';
      if (!location) return res.status(400).json({ success: false, message: 'Enter the in-person meeting location.' });
      if (location.length > 300) return res.status(400).json({ success: false, message: 'Location must be 300 characters or fewer.' });
      session.location = location;
      session.meetingLink = undefined;
    } else {
      return res.status(400).json({ success: false, message: 'This session does not have a valid meeting method.' });
    }

    await session.save();
    await session.populate(SESSION_POPULATE);
    res.json({
      success: true,
      message: session.meetingMethod === 'online' ? 'Meeting link saved.' : 'Meeting location saved.',
      data: session,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Meeting details could not be saved.' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const result = await findParticipantSession(req, res);
    if (!result) return;
    const messages = await SessionMessage.find({ session: result.session._id })
      .populate('sender', 'name')
      .sort({ createdAt: 1 });
    res.json({ success: true, message: 'Messages retrieved.', data: messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Session messages could not be loaded.' });
  }
};

exports.createMessage = async (req, res) => {
  try {
    const result = await findParticipantSession(req, res);
    if (!result) return;
    if (!['accepted', 'completed'].includes(result.session.status)) {
      return res.status(400).json({ success: false, message: 'Messages are available after the session is accepted.' });
    }
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
    if (!body) return res.status(400).json({ success: false, message: 'Enter a message before sending.' });
    if (body.length > 1000) return res.status(400).json({ success: false, message: 'Your message must be 1000 characters or fewer.' });

    const message = await SessionMessage.create({ session: result.session._id, sender: req.user.id, body });
    await message.populate('sender', 'name');
    res.status(201).json({ success: true, message: 'Message sent.', data: message });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Message could not be sent.' });
  }
};

exports.confirmSession = async (req, res) => {
  if (!validateSessionId(req, res)) return;
  const dbSession = await mongoose.startSession();
  let settledSession;
  let alreadySettled = false;
  try {
    await dbSession.withTransaction(async () => {
      const session = await Session.findById(req.params.id).session(dbSession);
      if (!session) throw Object.assign(new Error('Session not found.'), { status: 404 });
      const { isLearner, isTutor } = participantFlags(session, req.user.id);
      if (!isLearner && !isTutor) throw Object.assign(new Error('You are not part of this session.'), { status: 403 });
      if (!isLearner) throw Object.assign(new Error('Only the Learner can confirm this session.'), { status: 403 });
      if (session.status !== 'completed') {
        throw Object.assign(new Error('The Tutor must mark the session complete first.'), { status: 400 });
      }
      if (session.confirmedAt || session.creditsSettledAt) {
        throw Object.assign(new Error('This session has already been confirmed.'), { status: 409 });
      }

      // Old development sessions may already have a payment transaction from
      // the previous completion flow. Confirm without moving credits again.
      const existingTransaction = await CreditTransaction.findOne({ session: session._id }).session(dbSession);
      if (existingTransaction) {
        const confirmedAt = new Date();
        session.confirmedAt = confirmedAt;
        session.creditsSettledAt = existingTransaction.createdAt || confirmedAt;
        await session.save({ session: dbSession });
        settledSession = session;
        alreadySettled = true;
        return;
      }

      const learner = await User.findById(session.learner).session(dbSession);
      if (!learner || learner.credits < session.creditAmount) {
        throw Object.assign(new Error('You do not have enough credits to confirm this session.'), { status: 400 });
      }
      const tutor = await User.findOneAndUpdate(
        { _id: session.tutor, role: 'student' },
        { $inc: { credits: session.creditAmount } },
        { session: dbSession, new: true }
      );
      if (!tutor) throw Object.assign(new Error('Tutor account is unavailable.'), { status: 400 });

      learner.credits -= session.creditAmount;
      await learner.save({ session: dbSession });

      const now = new Date();
      await CreditTransaction.create([{
        fromUser: session.learner,
        toUser: session.tutor,
        amount: session.creditAmount,
        session: session._id,
      }], { session: dbSession });
      session.confirmedAt = now;
      session.creditsSettledAt = now;
      await session.save({ session: dbSession });
      settledSession = session;
    });

    await settledSession.populate(SESSION_POPULATE);
    const tutorName = settledSession.tutor?.name || 'the Tutor';
    const message = alreadySettled
      ? 'Session confirmed. Its existing credit transaction was not repeated.'
      : `Session completed. ${settledSession.creditAmount} credit${settledSession.creditAmount === 1 ? '' : 's'} transferred to ${tutorName}.`;
    res.json({ success: true, message, data: settledSession });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'This session has already been confirmed.' });
    res.status(500).json({ success: false, message: 'Session confirmation could not be completed.' });
  } finally {
    await dbSession.endSession();
  }
};
