const User = require('../models/User');
const mongoose = require('mongoose');
const Session = require('../models/Session');
const CreditTransaction = require('../models/CreditTransaction');
const { classifyLegacySession, isSessionRatingEligible } = require('../utils/sessionLifecycleCompatibility');
const { isValidObjectId } = require('../middleware/validation');
const { logSecurityEvent } = require('../utils/securityLogger');
const { ACTIONS, recordAudit } = require('../services/auditService');
const notifications = require('../services/notificationService');

const MANAGEABLE_ROLES = new Set(['student', 'moderator']);
const { hasInFlightSessions } = require('../utils/sessionRoleGuard');

// GET /api/admin/users - lists platform accounts for user management.
exports.listUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('name email role credits rating skillsToTeach skillsToLearn emailVerified suspendedAt suspensionReason createdAt +failedLoginAttempts +loginCooldownUntil')
      .sort({ createdAt: -1 });

    res.json({ success: true, message: 'Users retrieved', data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while retrieving users' });
  }
};

// Admin session directory exposes coordination metadata, never private messages.
exports.listSessions = async (req, res) => {
  try {
    const sessions = await Session.find()
      .select('subject learner tutor scheduledAt status creditAmount createdAt completedAt confirmedAt creditsSettledAt awaitingValidationAt learnerConfirmedAt tutorConfirmedAt disputedAt disputeReason resolvedAt resolvedBy resolution resolutionNote')
      .populate('learner', 'name')
      .populate('tutor', 'name')
      .sort({ createdAt: -1 })
      .lean();
    const settledIds = sessions.filter((session) => ['completed', 'resolved'].includes(session.status))
      .map((session) => session._id);
    const payments = settledIds.length > 0
      ? await CreditTransaction.find({ session: { $in: settledIds } })
        .select('session fromUser toUser amount type').lean() : [];
    const paymentsBySession = new Map();
    for (const payment of payments) {
      const key = String(payment.session);
      if (!paymentsBySession.has(key)) paymentsBySession.set(key, []);
      paymentsBySession.get(key).push(payment);
    }
    const data = sessions.map((session) => {
      const evidence = paymentsBySession.get(String(session._id)) || [];
      return {
        ...session,
        ...classifyLegacySession(session, evidence),
        ratingEligible: isSessionRatingEligible(session, evidence),
      };
    });
    return res.json({ success: true, message: 'Sessions retrieved', data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Sessions could not be loaded.' });
  }
};

// PATCH /api/admin/users/:id/role - manages only student/moderator access.
exports.updateUserRole = async (req, res) => {
  let dbSession;
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }
    if (typeof role !== 'string' || !MANAGEABLE_ROLES.has(role)) {
      return res.status(400).json({ success: false, message: 'Role must be student or moderator' });
    }
    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot change your own role' });
    }

    dbSession = await mongoose.startSession();
    let updatedUser;
    await dbSession.withTransaction(async () => {
      const target = await User.findById(id).select('_id role').session(dbSession).lean();
      if (!target) throw Object.assign(new Error('User not found'), { status: 404 });
      if (target.role === 'admin') throw Object.assign(new Error('Admin roles cannot be changed'), { status: 403 });
      if (target.role === role) throw Object.assign(new Error('Role is already set'), { status: 409 });
      // Lock the participant before checking Sessions. Request creation takes the
      // same existing User document lock, so a concurrent request cannot slip in.
      await User.updateOne({ _id: id, role: target.role }, { $currentDate: { updatedAt: true } },
        { session: dbSession, timestamps: false });
      if (target.role === 'student' && role === 'moderator'
        && await hasInFlightSessions(id, dbSession)) {
        throw Object.assign(new Error('Active Sessions must be completed, cancelled, or resolved before promoting this Student to Moderator.'), { status: 409 });
      }
      updatedUser = await User.findOneAndUpdate({ _id: id, role: target.role }, { $set: { role } },
        { new: true, runValidators: true, session: dbSession })
        .select('name email role credits rating skillsToTeach skillsToLearn emailVerified suspendedAt suspensionReason createdAt +failedLoginAttempts +loginCooldownUntil');
      if (!updatedUser) throw Object.assign(new Error('Role changed. Reload and try again.'), { status: 409 });
      await recordAudit({ actor: req.user, action: ACTIONS.role, targetType: 'User', targetId: id,
        summary: role === 'moderator' ? 'Moderator access granted' : 'Moderator access revoked',
        metadata: { previousRole: target.role, newRole: role }, session: dbSession });
    });

    logSecurityEvent('admin.role_changed', req, { targetId: id, newRole: role });

    return res.json({ success: true, message: `User role updated to ${role}`, data: updatedUser });
  } catch (error) {
    return res.status(error.status || 503).json({ success: false,
      message: error.status ? error.message : 'User role could not be updated' });
  } finally { if (dbSession) await dbSession.endSession(); }
};

// Status changes preserve Sessions, ledger entries, reviews and historical references.
exports.updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const suspend = req.body.status === 'suspended';
  if (suspend && !req.body.reason) return res.status(400).json({ success: false, message: 'Suspension reason is required' });
  if (id === req.user.id) return res.status(400).json({ success: false, message: 'You cannot change your own account status' });
  let dbSession;
  try {
    dbSession = await mongoose.startSession();
    let updatedUser;
    await dbSession.withTransaction(async () => {
      const target = await User.findById(id).select('_id role suspendedAt').session(dbSession).lean();
      if (!target) throw Object.assign(new Error('User not found'), { status: 404 });
      if (target.role === 'admin') throw Object.assign(new Error('Admin accounts are protected'), { status: 403 });
      if (Boolean(target.suspendedAt) === suspend) {
        throw Object.assign(new Error('Account status is already set'), { status: 409 });
      }
      const filter = { _id: id, role: target.role, suspendedAt: suspend ? null : target.suspendedAt };
      const changes = suspend
        ? { suspendedAt: new Date(), suspendedBy: req.user.id, suspensionReason: req.body.reason }
        : { suspendedAt: null, suspendedBy: null, suspensionReason: null };
      updatedUser = await User.findOneAndUpdate(filter, { $set: changes },
        { new: true, runValidators: true, session: dbSession })
        .select('name email role credits rating skillsToTeach skillsToLearn emailVerified suspendedAt suspensionReason createdAt +failedLoginAttempts +loginCooldownUntil');
      if (!updatedUser) throw Object.assign(new Error('Account changed. Reload and try again.'), { status: 409 });
      await recordAudit({ actor: req.user, action: suspend ? ACTIONS.suspended : ACTIONS.reactivated,
        targetType: 'User', targetId: id, summary: suspend ? 'Account suspended' : 'Account reactivated',
        metadata: { previousStatus: suspend ? 'active' : 'suspended',
          newStatus: suspend ? 'suspended' : 'active',
          ...(suspend ? { suspensionReason: req.body.reason } : {}) }, session: dbSession });
    });
    logSecurityEvent(suspend ? 'admin.user_suspended' : 'admin.user_reactivated', req, { targetId: id });
    await notifications.notifySafely({ recipient: id,
      type: suspend ? 'account.suspended' : 'account.reactivated', relatedType: 'User', relatedId: id,
      eventKey: `account.${suspend ? 'suspended' : 'reactivated'}:${id}:${updatedUser.suspendedAt || updatedUser.updatedAt || Date.now()}` });
    return res.json({ success: true, data: updatedUser });
  } catch (error) {
    return res.status(error.status || 503).json({ success: false,
      message: error.status ? error.message : 'Account status could not be updated' });
  } finally { if (dbSession) await dbSession.endSession(); }
};
