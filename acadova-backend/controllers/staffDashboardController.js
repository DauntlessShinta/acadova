const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Session = require('../models/Session');
const LearningResource = require('../models/LearningResource');
const StudySet = require('../models/StudySet');
const StudyReport = require('../models/StudyReport');
const { aggregate } = require('../utils/analyticsWindow');
const { ACTIONS } = require('../services/auditService');
const { LOGIN_ACTIONS, REVIEW_ACTIONS, SESSION_DECISIONS, MODERATION_ACTIONS, ADMIN_ACTIONS } = require('../utils/staffDashboardDefinitions');

exports.getTrustSummary = async (req, res) => {
  try {
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [rows, activeCooldowns] = await Promise.all([
      aggregate(AuditLog, [{ $match: { createdAt: { $gte: since, $lte: now } } },
        { $group: { _id: { action: '$action', role: '$actorRole' }, count: { $sum: 1 } } }]),
      User.countDocuments({ loginCooldownUntil: { $gt: now } }).maxTimeMS(8000),
    ]);
    const count = (actions, role) => rows.filter(row => actions.includes(row._id.action) && (!role || row._id.role === role)).reduce((sum, row) => sum + row.count, 0);
    res.json({ success: true, data: { protectionEvents: count(LOGIN_ACTIONS), roleChanges: count([ACTIONS.role]),
      adminActions: count(ADMIN_ACTIONS, 'admin'), activeCooldowns, since } });
  } catch { res.status(503).json({ success: false, message: 'Trust summary is temporarily unavailable.' }); }
};

// Read-only summaries expose moderation records, never the Admin audit directory.
exports.getModeratorOverview = async (req, res) => {
  const { days = '7' } = req.query;
  if (!req.analyticsWindow && (Object.keys(req.query).some(key => key !== 'days') || !['7', '30', '90'].includes(days))) {
    return res.status(400).json({ success: false, message: 'Choose a supported moderation period.' });
  }
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const since = req.analyticsWindow?.start || new Date(today.getTime() - (Number(days) - 1) * 86400000);
  const tomorrow = new Date(today.getTime() + 86400000);
  const until = req.analyticsWindow?.end || tomorrow;
  const auditFilter = { action: { $in: MODERATION_ACTIONS }, actorRole: { $in: ['admin', 'moderator'] } };
  const exceptions = { $or: [{ status: 'disputed' },
    { status: 'awaiting_validation', 'reviewReferral.id': { $exists: true }, 'reviewReferral.closedAt': null }] };
  const queueProject = { _id: 1, title: 1, date: 1 };
  const queue = (model, match, title, date) => aggregate(model, [{ $match: match },
    { $project: { ...queueProject, title, date } }, { $sort: { date: 1, _id: 1 } }, { $limit: 12 }]);
  try {
    const [resources, studySets, reports, disputes, decisionsToday, recent, decisionsTrend, reportsTrend,
      resourceQueue, studyQueue, sessionQueue, reportQueue] = await Promise.all([
      LearningResource.countDocuments({ reviewStatus: 'submitted' }).maxTimeMS(8000),
      StudySet.countDocuments({ state: 'pending', deletedAt: null }).maxTimeMS(8000),
      StudyReport.countDocuments({ state: 'open' }).maxTimeMS(8000),
      Session.countDocuments({ status: 'disputed' }).maxTimeMS(8000),
      AuditLog.countDocuments({ ...auditFilter, createdAt: { $gte: today, $lt: tomorrow } }).maxTimeMS(8000),
      AuditLog.find(auditFilter).select('actor actorRole action targetType targetId summary createdAt metadata.newStatus metadata.resolution metadata.hidden')
        .sort({ createdAt: -1, _id: -1 }).limit(6).populate('actor', 'name').lean().maxTimeMS(8000),
      aggregate(AuditLog, [{ $match: { ...auditFilter, createdAt: { $gte: since, $lt: until } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
          reviews: { $sum: { $cond: [{ $in: ['$action', REVIEW_ACTIONS] }, 1, 0] } },
          sessions: { $sum: { $cond: [{ $in: ['$action', SESSION_DECISIONS] }, 1, 0] } } } }, { $sort: { _id: 1 } }]),
      aggregate(StudyReport, [{ $match: { createdAt: { $gte: since, $lt: until } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, reports: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      queue(LearningResource, { reviewStatus: 'submitted' }, '$title', '$createdAt'),
      queue(StudySet, { state: 'pending', deletedAt: null }, '$title', { $ifNull: ['$submittedAt', '$updatedAt'] }),
      queue(Session, exceptions, '$subject', { $ifNull: ['$reviewReferral.createdAt', { $ifNull: ['$disputedAt', '$createdAt'] }] }),
      aggregate(StudyReport, [{ $match: { state: 'open' } },
        { $group: { _id: '$studySet', date: { $min: '$createdAt' }, count: { $sum: 1 } } },
        { $lookup: { from: StudySet.collection.name, localField: '_id', foreignField: '_id', as: 'study' } },
        { $project: { _id: 1, date: 1, count: 1, title: { $arrayElemAt: ['$study.title', 0] } } },
        { $sort: { date: 1, _id: 1 } }, { $limit: 12 }]),
    ]);
    const items = (rows, type, detail, href) => rows.map(row => ({ id: String(row._id), type,
      title: row.title || 'Untitled record', date: row.date || null, detail: typeof detail === 'function' ? detail(row) : detail,
      href: href(String(row._id)) }));
    const priorityQueue = [
      ...items(resourceQueue, 'content', 'Resource awaiting publication review', () => '/moderator/learning#manage-panel-resources'),
      ...items(studyQueue, 'study', 'Study Set awaiting publication review', id => '/moderator/study-sets?set=' + id),
      ...items(sessionQueue, 'dispute', 'Session dispute or explicit review referral', id => '/moderator/disputes?session=' + id),
      ...items(reportQueue, 'report', row => `${row.count} open Study Set report${row.count === 1 ? '' : 's'}`, id => '/moderator/study-sets?set=' + id),
    ].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0) || a.id.localeCompare(b.id)).slice(0, 12);
    res.json({ success: true, data: { counts: { pendingReviews: resources + studySets, pendingResources: resources,
      pendingStudySets: studySets, reportedContent: reports, sessionDisputes: disputes, decisionsToday },
      queue: priorityQueue, recent, trend: { decisions: decisionsTrend, reports: reportsTrend },
      from: since.toISOString().slice(0, 10), to: new Date(until.getTime() - 1).toISOString().slice(0, 10) } });
  } catch { res.status(503).json({ success: false, message: 'Moderator overview is temporarily unavailable.' }); }
};
