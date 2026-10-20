const User = require('../models/User');
const mongoose = require('mongoose');
const Session = require('../models/Session');
const CreditTransaction = require('../models/CreditTransaction');
const { classifyLegacySession, isSessionRatingEligible } = require('../utils/sessionLifecycleCompatibility');
const { isValidObjectId, escapeRegExp } = require('../middleware/validation');
const { logSecurityEvent } = require('../utils/securityLogger');
const { ACTIONS, recordAudit } = require('../services/auditService');
const notifications = require('../services/notificationService');

const MANAGEABLE_ROLES = new Set(['student', 'moderator']);
const { hasInFlightSessions } = require('../utils/sessionRoleGuard');
const { aggregate } = require('../utils/analyticsWindow');
const LearningResource = require('../models/LearningResource');
const StudySet = require('../models/StudySet');
const StudyReport = require('../models/StudyReport');

// Operational counts use current record state, not a date-filtered cohort.
exports.getOperations = async (req, res) => {
  try {
    const [sessions, resources, studySets, studyReports, credits] = await Promise.all([
      aggregate(Session, [{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      LearningResource.countDocuments({ reviewStatus: 'submitted' }).maxTimeMS(8000),
      StudySet.countDocuments({ state: 'pending', deletedAt: null }).maxTimeMS(8000),
      StudyReport.countDocuments({ state: 'open' }).maxTimeMS(8000),
      CreditTransaction.find({ type: { $in: ['session_payment', 'assessment_reward', 'learning_unlock', 'initial_grant', 'admin_adjustment'] } })
        .select('type amount adjustmentDirection createdAt').sort({ createdAt: -1, _id: -1 }).limit(6).lean().maxTimeMS(8000),
    ]);
    res.json({ success: true, data: { byStatus: Object.fromEntries(sessions.map(row => [row._id, row.count])),
      pendingResources: resources, pendingStudySets: studySets, openStudyReports: studyReports, recentCredits: credits } });
  } catch { res.status(503).json({ success: false, message: 'Operational overview is temporarily unavailable.' }); }
};

// Database counts do not depend on the downloaded directory or visible filters.
exports.getOverview = async (req, res) => {
  try {
    const rows = await aggregate(User, [{ $group: { _id: '$role', count: { $sum: 1 },
      suspended: { $sum: { $cond: [{ $ifNull: ['$suspendedAt', false] }, 1, 0] } },
      unverified: { $sum: { $cond: [{ $eq: ['$emailVerified', false] }, 1, 0] } },
    } }]);
    res.json({ success: true, data: { total: rows.reduce((sum, row) => sum + row.count, 0),
      students: rows.find(row => row._id === 'student')?.count || 0,
      moderators: rows.find(row => row._id === 'moderator')?.count || 0,
      suspended: rows.reduce((sum, row) => sum + row.suspended, 0),
      unverified: rows.reduce((sum, row) => sum + row.unverified, 0),
    } });
  } catch { res.status(503).json({ success: false, message: 'Account overview is temporarily unavailable.' }); }
};

// GET /api/admin/users - lists platform accounts for user management.
exports.listUsers = async (req, res) => {
  try {
    const { q, id, role, status, page = 1 } = req.validatedQuery || {};
    const filter = {};
    if (id) filter._id = id;
    if (role) filter.role = role;
    if (status === 'suspended') filter.suspendedAt = { $ne: null };
    if (status === 'active') filter.suspendedAt = null;
    if (status === 'unverified') filter.emailVerified = false;
    if (q) filter.$or = ['name', 'email'].map(key => ({ [key]: { $regex: escapeRegExp(q), $options: 'i' } }));
    const [users, total] = await Promise.all([User.find(filter)
      .select('name email role credits rating skillsToTeach skillsToLearn emailVerified suspendedAt suspensionReason createdAt +failedLoginAttempts +loginCooldownUntil')
      .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 25).limit(25).maxTimeMS(8000),
      User.countDocuments(filter).maxTimeMS(8000)]);

    res.json({ success: true, message: 'Users retrieved', data: users, pagination: { page, pageSize: 25, total, pages: Math.ceil(total / 25) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while retrieving users' });
  }
};

// Admin session directory exposes coordination metadata, never private messages.
exports.listSessions = async (req, res) => {
  try {
    const { q, status, page = 1 } = req.validatedQuery || {};
    const statuses = status === 'scheduled' ? ['scheduled', 'accepted'] : status === 'declined' ? ['declined', 'rejected'] : [status];
    const pipeline = [];
    if (status) pipeline.push({ $match: { status: { $in: statuses } } });
    const publicFields = {"subject": 1, "learner": 1, "tutor": 1, "scheduledAt": 1, "status": 1, "creditAmount": 1, "createdAt": 1, "completedAt": 1, "confirmedAt": 1, "creditsSettledAt": 1, "awaitingValidationAt": 1, "learnerConfirmedAt": 1, "tutorConfirmedAt": 1, "disputedAt": 1, "disputeReason": 1, "resolvedAt": 1, "resolvedBy": 1, "resolution": 1, "resolutionNote": 1, "reviewReferral": 1, "validationDeadlineAt": 1, "reviewVersion": 1, "startedAt": 1, "learnerCheckedInAt": 1, "tutorCheckedInAt": 1};
    pipeline.push({ $project: publicFields });
    for (const field of ['learner', 'tutor']) pipeline.push(
      { $lookup: { from: User.collection.name, let: { participantId: '$' + field }, pipeline: [
        { $match: { $expr: { $eq: ['$_id', '$$participantId'] } } }, { $project: { name: 1 } },
      ], as: field } },
      { $set: { [field]: { $arrayElemAt: ['$' + field, 0] } } },
    );
    if (q) pipeline.push({ $match: { $or: ['subject', 'learner.name', 'tutor.name'].map(field => ({ [field]: { $regex: escapeRegExp(q), $options: 'i' } })) } });
    pipeline.push({ $facet: { count: [{ $count: 'total' }], rows: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * 25 }, { $limit: 25 }] } });
    const [result] = await aggregate(Session, pipeline);
    const sessions = result?.rows || [];
    const total = result?.count?.[0]?.total || 0;
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
    return res.json({ success: true, message: 'Sessions retrieved', data, pagination: { page, pageSize: 25, total, pages: Math.ceil(total / 25) } });
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
      updatedUser = await User.findOneAndUpdate({ _id: id, role: target.role }, { $set: { role, authVersion: require('node:crypto').randomBytes(32).toString('hex') } },
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
      changes.authVersion = require('node:crypto').randomBytes(32).toString('hex');
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
