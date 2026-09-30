const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const Session = require('../models/Session');
const SessionMessage = require('../models/SessionMessage');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const Rating = require('../models/Rating');
const { isSessionRatingEligible, matchesPayment } = require('../utils/sessionLifecycleCompatibility');
const { transferSessionCredits } = require('../services/sessionSettlement');
const { getEffectiveCreditRules } = require('../services/creditRuleService');
const { isValidObjectId } = require('../middleware/validation');

const ALLOWED_TRANSITIONS = {
  // Legacy inputs stay stored as-is so deployed React clients retain their
  // accepted -> completed action; canonical inputs store canonical values.
  pending: ['accepted', 'scheduled', 'rejected', 'declined', 'cancelled'],
  accepted: ['completed', 'cancelled'],
  scheduled: [],
  rejected: [],
  declined: [],
  completed: [],
  cancelled: [],
};

const SESSION_POPULATE = [
  { path: 'learner', select: 'name' },
  { path: 'tutor', select: 'name' },
];

const sameUser = (left, right) => String(left).toLowerCase() === String(right).toLowerCase();
const changedSessionMessage = 'This session has already changed. Refresh and try again.';
const reschedulableStatuses = ['accepted', 'scheduled'];
const rescheduleFields = {
  proposedScheduledAt: 1,
  rescheduleProposedBy: 1,
  rescheduleProposedAt: 1,
  rescheduleProposalId: 1,
};
// Check-in opens 15 minutes before the agreed start and closes 4 hours after it.
const CHECK_IN_EARLY_MS = 15 * 60 * 1000;
const CHECK_IN_LATE_MS = 4 * 60 * 60 * 1000;

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
    const { tutorId, subject, scheduledAt, meetingMethod, requestMessage } = req.body;
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

    // Legacy clients may still submit creditAmount, but it never sets the price.
    const { tutoringSessionCost } = await getEffectiveCreditRules();
    if (Number.isFinite(req.user.credits) && req.user.credits < tutoringSessionCost) {
      return res.status(400).json({ success: false, message: `You need ${tutoringSessionCost} credits to request a tutoring session.` });
    }
    if (sameUser(tutorId, req.user.id)) {
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
      creditAmount: tutoringSessionCost,
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
    // Read the existing rating, including moderated ratings. Hiding a review
    // does not make its author eligible to submit another one. Never persist
    // this viewer-specific field on the shared session document.
    const myReview = Boolean(await Rating.exists({ session: result.session._id, fromUser: req.user.id }));
    const payments = ['completed', 'resolved'].includes(result.session.status)
      ? await CreditTransaction.find({ session: result.session._id }) : [];
    const ratingEligible = isSessionRatingEligible(result.session, payments);
    res.json({ success: true, message: 'Session retrieved.', data: { ...result.session.toObject(), myReview, ratingEligible } });
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
    if (['accepted', 'scheduled', 'rejected', 'declined'].includes(status) && !isTutor) {
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

    const changes = { status };
    if (status === 'completed') changes.completedAt = new Date();
    const update = { $set: changes };
    if (session.status === 'accepted' && ['completed', 'cancelled'].includes(status)) {
      update.$unset = rescheduleFields;
    }
    const updatedSession = await Session.findOneAndUpdate(
      { _id: session._id, status: session.status },
      update,
      { new: true, runValidators: true }
    );
    if (!updatedSession) {
      return res.status(409).json({ success: false, message: changedSessionMessage });
    }
    await updatedSession.populate(SESSION_POPULATE);

    const message = {
      completed: 'Session marked complete. Waiting for learner confirmation.',
      accepted: 'Session accepted.',
      scheduled: 'Session scheduled.',
      rejected: 'Session declined.',
      declined: 'Session declined.',
      cancelled: 'Session cancelled.',
    }[status];
    res.json({ success: true, message, data: updatedSession });
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
    if (!reschedulableStatuses.includes(session.status)) {
      return res.status(400).json({ success: false, message: 'Meeting details can be updated after the session is accepted.' });
    }

    let changes;
    if (session.meetingMethod === 'online') {
      const meetingLink = typeof req.body.meetingLink === 'string' ? req.body.meetingLink.trim() : '';
      if (!meetingLink || !isHttpsUrl(meetingLink)) {
        return res.status(400).json({ success: false, message: 'Enter a valid HTTPS meeting link.' });
      }
      if (meetingLink.length > 500) return res.status(400).json({ success: false, message: 'Meeting link must be 500 characters or fewer.' });
      changes = { $set: { meetingLink }, $unset: { location: 1 } };
    } else if (session.meetingMethod === 'in-person') {
      const location = typeof req.body.location === 'string' ? req.body.location.trim() : '';
      if (!location) return res.status(400).json({ success: false, message: 'Enter the in-person meeting location.' });
      if (location.length > 300) return res.status(400).json({ success: false, message: 'Location must be 300 characters or fewer.' });
      changes = { $set: { location }, $unset: { meetingLink: 1 } };
    } else {
      return res.status(400).json({ success: false, message: 'This session does not have a valid meeting method.' });
    }

    const updatedSession = await Session.findOneAndUpdate(
      { _id: session._id, status: session.status, meetingMethod: session.meetingMethod },
      changes,
      { new: true, runValidators: true }
    );
    if (!updatedSession) {
      return res.status(409).json({ success: false, message: changedSessionMessage });
    }
    await updatedSession.populate(SESSION_POPULATE);
    res.json({
      success: true,
      message: session.meetingMethod === 'online' ? 'Meeting link saved.' : 'Meeting location saved.',
      data: updatedSession,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Meeting details could not be saved.' });
  }
};

exports.proposeReschedule = async (req, res) => {
  try {
    const result = await findParticipantSession(req, res);
    if (!result) return;
    const { session } = result;
    if (!reschedulableStatuses.includes(session.status)) {
      return res.status(400).json({ success: false, message: 'Only scheduled sessions can be rescheduled.' });
    }
    if (session.rescheduleProposalId || session.proposedScheduledAt) {
      return res.status(409).json({ success: false, message: 'A reschedule proposal is already pending.' });
    }
    const proposedDate = new Date(req.body.scheduledAt);
    if (Number.isNaN(proposedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Enter a valid proposed date and time.' });
    }
    if (proposedDate <= new Date()) {
      return res.status(400).json({ success: false, message: 'Choose a future date and time.' });
    }
    if (session.scheduledAt && proposedDate.getTime() === new Date(session.scheduledAt).getTime()) {
      return res.status(400).json({ success: false, message: 'Choose a different time from the current schedule.' });
    }
    const updatedSession = await Session.findOneAndUpdate(
      {
        _id: session._id,
        status: session.status,
        scheduledAt: session.scheduledAt ?? null,
        rescheduleProposalId: null,
        proposedScheduledAt: null,
      },
      { $set: {
        proposedScheduledAt: proposedDate,
        rescheduleProposedBy: req.user.id,
        rescheduleProposedAt: new Date(),
        rescheduleProposalId: randomUUID(),
      } },
      { new: true, runValidators: true }
    );
    if (!updatedSession) return res.status(409).json({ success: false, message: changedSessionMessage });
    await updatedSession.populate(SESSION_POPULATE);
    return res.json({ success: true, message: 'Reschedule proposed. Waiting for your peer to respond.', data: updatedSession });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Reschedule could not be proposed.' });
  }
};

const decideReschedule = async (req, res, accept) => {
  try {
    const result = await findParticipantSession(req, res);
    if (!result) return;
    const { session } = result;
    if (!reschedulableStatuses.includes(session.status)) {
      return res.status(400).json({ success: false, message: 'Only scheduled sessions can be rescheduled.' });
    }
    if (!session.rescheduleProposalId || session.rescheduleProposalId !== req.body.proposalId
      || !session.proposedScheduledAt || !session.rescheduleProposedBy) {
      return res.status(409).json({ success: false, message: changedSessionMessage });
    }
    if (sameUser(session.rescheduleProposedBy, req.user.id)) {
      return res.status(403).json({ success: false, message: 'Only the other participant can respond to this proposal.' });
    }
    if (accept && new Date(session.proposedScheduledAt) <= new Date()) {
      return res.status(400).json({ success: false, message: 'This proposed time has passed. Ask for a new proposal.' });
    }
    const update = { $unset: rescheduleFields };
    if (accept) {
      update.$set = { scheduledAt: session.proposedScheduledAt };
      // Attendance for the old agreed time cannot carry over to a new time.
      update.$unset = { ...rescheduleFields, learnerCheckedInAt: 1, tutorCheckedInAt: 1 };
    }
    const updatedSession = await Session.findOneAndUpdate(
      {
        _id: session._id,
        status: session.status,
        scheduledAt: session.scheduledAt ?? null,
        proposedScheduledAt: session.proposedScheduledAt,
        rescheduleProposalId: req.body.proposalId,
        rescheduleProposedBy: session.rescheduleProposedBy,
      },
      update,
      { new: true, runValidators: true }
    );
    if (!updatedSession) return res.status(409).json({ success: false, message: changedSessionMessage });
    await updatedSession.populate(SESSION_POPULATE);
    return res.json({
      success: true,
      message: accept ? 'Reschedule accepted. The session time was updated.' : 'Reschedule declined. The original time remains.',
      data: updatedSession,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Reschedule response could not be saved.' });
  }
};

exports.acceptReschedule = (req, res) => decideReschedule(req, res, true);
exports.declineReschedule = (req, res) => decideReschedule(req, res, false);

exports.checkIn = async (req, res) => {
  try {
    const result = await findParticipantSession(req, res);
    if (!result) return;
    const { session, isLearner } = result;
    if (!reschedulableStatuses.includes(session.status)) {
      return res.status(400).json({ success: false, message: 'Check-in is available only for a scheduled session.' });
    }
    if (session.rescheduleProposalId || session.proposedScheduledAt) {
      return res.status(409).json({ success: false, message: 'Resolve the reschedule proposal before checking in.' });
    }
    const scheduledAt = session.scheduledAt ? new Date(session.scheduledAt) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return res.status(400).json({ success: false, message: 'This session has no valid scheduled time.' });
    }
    const now = new Date();
    if (now.getTime() < scheduledAt.getTime() - CHECK_IN_EARLY_MS
      || now.getTime() > scheduledAt.getTime() + CHECK_IN_LATE_MS) {
      return res.status(400).json({ success: false, message: 'Check-in is available from 15 minutes before until 4 hours after the scheduled time.' });
    }
    const ownField = isLearner ? 'learnerCheckedInAt' : 'tutorCheckedInAt';
    const peerField = isLearner ? 'tutorCheckedInAt' : 'learnerCheckedInAt';
    if (session[ownField]) {
      return res.status(409).json({ success: false, message: 'You have already checked in.' });
    }

    // MongoDB serializes these updates on one Session document. The second
    // participant sees the first timestamp and starts the Session atomically.
    const peerHasCheckedIn = { $ne: [{ $ifNull: [`$${peerField}`, null] }, null] };
    const updatedSession = await Session.findOneAndUpdate(
      {
        _id: session._id,
        status: session.status,
        scheduledAt,
        rescheduleProposalId: null,
        proposedScheduledAt: null,
        [ownField]: null,
        startedAt: null,
      },
      [{ $set: {
        [ownField]: now,
        status: { $cond: [peerHasCheckedIn, 'in_progress', '$status'] },
        startedAt: { $cond: [peerHasCheckedIn, now, '$startedAt'] },
      } }],
      { new: true, updatePipeline: true }
    );
    if (!updatedSession) return res.status(409).json({ success: false, message: changedSessionMessage });
    await updatedSession.populate(SESSION_POPULATE);
    return res.json({
      success: true,
      message: updatedSession.status === 'in_progress'
        ? 'Both participants checked in. Session in progress.'
        : 'Checked in. Waiting for your peer.',
      data: updatedSession,
    });
  } catch (error) {
    console.error('Session check-in failed', {
      name: error.name,
      message: error.message,
      sessionId: req.params.id,
    });
    return res.status(500).json({ success: false, message: 'Session check-in could not be saved.' });
  }
};

exports.finishSession = async (req, res) => {
  try {
    const result = await findParticipantSession(req, res);
    if (!result) return;
    const { session, isTutor } = result;
    if (!isTutor) return res.status(403).json({ success: false, message: 'Only the Tutor can finish the live session.' });
    if (session.status !== 'in_progress') {
      return res.status(400).json({ success: false, message: 'Only an in-progress session can be finished.' });
    }
    if (!session.startedAt || !session.learnerCheckedInAt || !session.tutorCheckedInAt
      || session.rescheduleProposalId || session.proposedScheduledAt
      || session.learnerConfirmedAt || session.tutorConfirmedAt
      || session.completedAt || session.confirmedAt || session.creditsSettledAt) {
      return res.status(409).json({ success: false, message: 'Session check-in evidence is incomplete.' });
    }
    const updatedSession = await Session.findOneAndUpdate(
      {
        _id: session._id,
        status: 'in_progress',
        startedAt: session.startedAt,
        learnerCheckedInAt: session.learnerCheckedInAt,
        tutorCheckedInAt: session.tutorCheckedInAt,
        awaitingValidationAt: null,
        learnerConfirmedAt: null,
        tutorConfirmedAt: null,
        completedAt: null,
        confirmedAt: null,
        creditsSettledAt: null,
        rescheduleProposalId: null,
        proposedScheduledAt: null,
      },
      { $set: { status: 'awaiting_validation', awaitingValidationAt: new Date() } },
      { new: true, runValidators: true }
    );
    if (!updatedSession) return res.status(409).json({ success: false, message: changedSessionMessage });
    await updatedSession.populate(SESSION_POPULATE);
    return res.json({ success: true, message: 'Session finished. Both participants must confirm before credits transfer.', data: updatedSession });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Session could not be finished.' });
  }
};

exports.reportNoShow = async (req, res) => {
  try {
    const result = await findParticipantSession(req, res);
    if (!result) return;
    const { session } = result;
    if (!reschedulableStatuses.includes(session.status)) {
      return res.status(400).json({ success: false, message: 'No-show is available only for a scheduled session.' });
    }
    if (session.rescheduleProposalId || session.proposedScheduledAt || session.startedAt) {
      return res.status(409).json({ success: false, message: 'This session cannot be marked no-show while attendance or rescheduling is active.' });
    }
    const scheduledAt = session.scheduledAt ? new Date(session.scheduledAt) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return res.status(400).json({ success: false, message: 'This session has no valid scheduled time.' });
    }
    const now = new Date();
    if (now.getTime() <= scheduledAt.getTime() + CHECK_IN_LATE_MS) {
      return res.status(400).json({ success: false, message: 'Wait until the check-in window ends before reporting a no-show.' });
    }
    const learnerCheckedInAt = session.learnerCheckedInAt ?? null;
    const tutorCheckedInAt = session.tutorCheckedInAt ?? null;
    if (learnerCheckedInAt && tutorCheckedInAt) {
      return res.status(409).json({ success: false, message: 'Both participants checked in; no-show cannot be recorded.' });
    }
    if (session.completedAt || session.confirmedAt || session.creditsSettledAt
      || await CreditTransaction.exists({ session: session._id })) {
      return res.status(409).json({ success: false, message: 'A settled session cannot be marked no-show.' });
    }
    const noShowAbsent = learnerCheckedInAt ? 'tutor' : tutorCheckedInAt ? 'learner' : 'both';
    const updatedSession = await Session.findOneAndUpdate(
      {
        _id: session._id,
        status: session.status,
        scheduledAt,
        learnerCheckedInAt,
        tutorCheckedInAt,
        startedAt: null,
        rescheduleProposalId: null,
        proposedScheduledAt: null,
        noShowAt: null,
        completedAt: null,
        confirmedAt: null,
        creditsSettledAt: null,
      },
      { $set: { status: 'no_show', noShowAt: now, noShowReportedBy: req.user.id, noShowAbsent } },
      { returnDocument: 'after', runValidators: true }
    );
    if (!updatedSession) return res.status(409).json({ success: false, message: changedSessionMessage });
    await updatedSession.populate(SESSION_POPULATE);
    return res.json({ success: true, message: 'No-show recorded. No credits were transferred.', data: updatedSession });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No-show could not be recorded.' });
  }
};

exports.disputeSession = async (req, res) => {
  try {
    const result = await findParticipantSession(req, res);
    if (!result) return;
    const { session } = result;
    if (!['awaiting_validation', 'no_show'].includes(session.status)) {
      return res.status(400).json({ success: false, message: 'Only a session awaiting validation or recorded as no-show can be disputed.' });
    }
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length < 10 || reason.length > 500) {
      return res.status(400).json({ success: false, message: 'Dispute reason must be 10 to 500 characters.' });
    }
    if ((session.status === 'awaiting_validation'
      && (!session.awaitingValidationAt || !session.startedAt || !session.learnerCheckedInAt || !session.tutorCheckedInAt))
      || (session.status === 'no_show' && (!session.noShowAt || !session.noShowAbsent))) {
      return res.status(409).json({ success: false, message: 'Session evidence is incomplete.' });
    }
    if (session.completedAt || session.creditsSettledAt || await CreditTransaction.exists({ session: session._id })) {
      return res.status(409).json({ success: false, message: 'A settled session cannot use this dispute path.' });
    }
    const now = new Date();
    const updatedSession = await Session.findOneAndUpdate(
      {
        _id: session._id,
        status: session.status,
        awaitingValidationAt: session.awaitingValidationAt ?? null,
        noShowAt: session.noShowAt ?? null,
        learnerConfirmedAt: session.learnerConfirmedAt ?? null,
        tutorConfirmedAt: session.tutorConfirmedAt ?? null,
        disputedAt: null,
        completedAt: null,
        creditsSettledAt: null,
      },
      { $set: { status: 'disputed', disputedAt: now, disputedBy: req.user.id, disputeReason: reason } },
      { returnDocument: 'after', runValidators: true }
    );
    if (!updatedSession) return res.status(409).json({ success: false, message: changedSessionMessage });
    await updatedSession.populate(SESSION_POPULATE);
    return res.json({ success: true, message: 'Dispute submitted for Moderator review. No credits were transferred.', data: updatedSession });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Dispute could not be submitted.' });
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
    if (!['accepted', 'scheduled', 'in_progress', 'awaiting_validation', 'completed'].includes(result.session.status)) {
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
  let awaitingPeerConfirmation = false;
  try {
    await dbSession.withTransaction(async () => {
      settledSession = undefined;
      alreadySettled = false;
      awaitingPeerConfirmation = false;
      const session = await Session.findById(req.params.id).session(dbSession);
      if (!session) throw Object.assign(new Error('Session not found.'), { status: 404 });
      const { isLearner, isTutor } = participantFlags(session, req.user.id);
      if (!isLearner && !isTutor) throw Object.assign(new Error('You are not part of this session.'), { status: 403 });
      if (sameUser(session.learner, session.tutor)) {
        throw Object.assign(new Error('A session with the same learner and tutor cannot be confirmed.'), { status: 400 });
      }
      if (session.status === 'awaiting_validation') {
        if (!session.awaitingValidationAt || !session.startedAt
          || !session.learnerCheckedInAt || !session.tutorCheckedInAt
          || session.rescheduleProposalId || session.proposedScheduledAt
          || session.completedAt || session.confirmedAt || session.creditsSettledAt) {
          throw Object.assign(new Error('Session validation evidence is incomplete.'), { status: 409 });
        }
        const ownField = isLearner ? 'learnerConfirmedAt' : 'tutorConfirmedAt';
        const peerField = isLearner ? 'tutorConfirmedAt' : 'learnerConfirmedAt';
        if (session[ownField]) {
          throw Object.assign(new Error('You have already confirmed this session.'), { status: 409 });
        }
        const now = new Date();
        const finalConfirmation = Boolean(session[peerField]);
        if (finalConfirmation) {
          const existingPayment = await CreditTransaction.findOne({ session: session._id }).session(dbSession);
          if (existingPayment) {
            throw Object.assign(new Error('This session already has a credit transaction.'), { status: 409 });
          }
        }
        const changes = { [ownField]: now };
        if (finalConfirmation) {
          Object.assign(changes, {
            status: 'completed',
            completedAt: now,
            confirmedAt: isLearner ? now : session.learnerConfirmedAt,
            creditsSettledAt: now,
          });
        }
        const claim = await Session.updateOne(
          {
            _id: session._id,
            status: 'awaiting_validation',
            awaitingValidationAt: session.awaitingValidationAt,
            startedAt: session.startedAt,
            [ownField]: null,
            [peerField]: finalConfirmation ? { $ne: null } : null,
            completedAt: null,
            confirmedAt: null,
            creditsSettledAt: null,
          },
          { $set: changes },
          { session: dbSession }
        );
        if (claim.matchedCount !== 1) {
          throw Object.assign(new Error(changedSessionMessage), { status: 409 });
        }
        Object.assign(session, changes);
        if (finalConfirmation) await transferSessionCredits(session, dbSession);
        else awaitingPeerConfirmation = true;
        settledSession = session;
        return;
      }
      if (session.awaitingValidationAt) {
        throw Object.assign(new Error('This Session cannot use the legacy confirmation flow.'), { status: 409 });
      }
      if (!isLearner) throw Object.assign(new Error('Only the Learner can confirm this session.'), { status: 403 });
      if (session.status !== 'completed') {
        throw Object.assign(new Error('The Tutor must mark the session complete first.'), { status: 400 });
      }
      if (session.confirmedAt || session.creditsSettledAt) {
        throw Object.assign(new Error('This session has already been confirmed.'), { status: 409 });
      }

      const markConfirmed = async (confirmedAt, creditsSettledAt) => {
        const result = await Session.updateOne(
          { _id: session._id, status: 'completed', confirmedAt: null, creditsSettledAt: null },
          { $set: { confirmedAt, creditsSettledAt } },
          { session: dbSession }
        );
        if (result.matchedCount !== 1) {
          throw Object.assign(new Error(changedSessionMessage), { status: 409 });
        }
        session.confirmedAt = confirmedAt;
        session.creditsSettledAt = creditsSettledAt;
      };

      // Old development sessions may already have a payment transaction from
      // the previous completion flow. Confirm without moving credits again.
      const existingTransactions = await CreditTransaction.find({ session: session._id }).session(dbSession);
      if (existingTransactions.length > 0) {
        if (existingTransactions.length !== 1 || !matchesPayment(session, existingTransactions[0])) {
          throw Object.assign(new Error('This session has inconsistent credit evidence.'), { status: 409 });
        }
        const confirmedAt = new Date();
        await markConfirmed(confirmedAt, existingTransactions[0].createdAt || confirmedAt);
        settledSession = session;
        alreadySettled = true;
        return;
      }

      const now = new Date();
      await markConfirmed(now, now);

      await transferSessionCredits(session, dbSession);
      settledSession = session;
    });

    await settledSession.populate(SESSION_POPULATE);
    const tutorName = settledSession.tutor?.name || 'the Tutor';
    const message = awaitingPeerConfirmation
      ? 'Confirmation saved. Waiting for your peer before credits transfer.'
      : alreadySettled
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
