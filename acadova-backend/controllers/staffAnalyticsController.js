const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Session = require('../models/Session');
const LearningResource = require('../models/LearningResource');
const StudySet = require('../models/StudySet');
const StudyReport = require('../models/StudyReport');
const StudyCircle = require('../models/StudyCircle');
const { aggregate } = require('../utils/analyticsWindow');
const { MODERATION_ACTIONS, ADMIN_ACTIONS } = require('../utils/staffDashboardDefinitions');
const { ACTIONS } = require('../services/auditService');
const DAY = 86400000;
const day = field => ({ $dateToString: { format: '%Y-%m-%d', date: '$' + field, timezone: 'UTC' } });
const moderationActions = MODERATION_ACTIONS;
const moderationFilter = { action: { $in: moderationActions }, actorRole: { $in: ['admin', 'moderator'] } };
function period(req) {
  const end = new Date(); end.setUTCHours(24, 0, 0, 0);
  return req.analyticsWindow || { start: new Date(end.getTime() - 30 * DAY), end };
}
const rangeDto = range => ({ from: range.start.toISOString().slice(0, 10), to: new Date(range.end - 1).toISOString().slice(0, 10) });
const outcome = { $switch: { branches: [
  { case: { $or: [{ $in: ['$action', [ACTIONS.resourcePublished, ACTIONS.topicPublished, ACTIONS.modulePublished, ACTIONS.assessmentPublished]] },
    { $and: [{ $eq: ['$action', ACTIONS.studyDecision] }, { $eq: ['$metadata.newStatus', 'published'] }] }] }, then: 'approved' },
  { case: { $or: [{ $eq: ['$action', ACTIONS.resourceRejected] },
    { $and: [{ $eq: ['$action', ACTIONS.studyDecision] }, { $eq: ['$metadata.newStatus', 'rejected'] }] }] }, then: 'rejected' },
], default: 'other' } };

// Administrator-only, bounded recorded activity. Never returns audit metadata.
exports.getAdminDashboard = async (req, res) => {
  const range = period(req);
  try {
    const [signups, moderation, recent] = await Promise.all([
      aggregate(User, [{ $match: { createdAt: { $gte: range.start, $lt: range.end } } }, { $group: { _id: day('createdAt'), count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      aggregate(AuditLog, [{ $match: { ...moderationFilter, createdAt: { $gte: range.start, $lt: range.end } } }, { $group: { _id: day('createdAt'), count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      AuditLog.find({ actorRole: { $in: ['admin', 'moderator'] }, action: { $in: [...ADMIN_ACTIONS, ...moderationActions] }, createdAt: { $gte: range.start, $lt: range.end } })
        .select('actor action summary createdAt').sort({ createdAt: -1, _id: -1 }).limit(5).populate('actor', 'name').lean().maxTimeMS(8000),
    ]);
    res.json({ success: true, data: { ...rangeDto(range), signups, moderation, recent } });
  } catch { res.status(503).json({ success: false, message: 'Recorded platform activity could not be loaded. Please retry.' }); }
};

// Moderator/Admin aggregate contract: no student names, titles, reasons, IDs or private source content.
exports.getModeratorAnalytics = async (req, res) => {
  const range = period(req); const now = new Date();
  const queueRows = (model, match, date) => aggregate(model, [{ $match: match }, { $project: { date } },
    { $group: { _id: { $switch: { branches: [
      { case: { $not: [{ $eq: [{ $type: '$date' }, 'date'] }] }, then: 'unknown' },
      { case: { $gte: ['$date', new Date(now - 2 * DAY)] }, then: '0-1 days' },
      { case: { $gte: ['$date', new Date(now - 4 * DAY)] }, then: '2-3 days' },
      { case: { $gte: ['$date', new Date(now - 8 * DAY)] }, then: '4-7 days' },
    ], default: '8+ days' } }, count: { $sum: 1 } } }]);
  const exceptions = { $or: [{ status: 'disputed' }, { status: 'awaiting_validation', 'reviewReferral.id': { $exists: true }, 'reviewReferral.closedAt': null }] };
  try {
    const [resources, sets, reports, sessions, circles, decisions, reportCount] = await Promise.all([
      queueRows(LearningResource, { reviewStatus: 'submitted' }, '$createdAt'),
      queueRows(StudySet, { state: 'pending', deletedAt: null }, { $ifNull: ['$submittedAt', '$updatedAt'] }),
      queueRows(StudyReport, { state: 'open' }, '$createdAt'),
      queueRows(Session, exceptions, { $ifNull: ['$reviewReferral.createdAt', { $ifNull: ['$disputedAt', '$createdAt'] }] }),
      queueRows(StudyCircle, { reports: { $elemMatch: { open: true } } }, { $min: { $map: { input: { $filter: { input: '$reports', as: 'report', cond: { $eq: ['$$report.open', true] } } }, as: 'report', in: '$$report.at' } } }),
      aggregate(AuditLog, [{ $match: { ...moderationFilter, createdAt: { $gte: range.start, $lt: range.end } } },
        { $project: { date: day('createdAt'), outcome } }, { $group: { _id: { date: '$date', outcome: '$outcome' }, count: { $sum: 1 } } }, { $sort: { '_id.date': 1, '_id.outcome': 1 } }]),
      StudyReport.countDocuments({ createdAt: { $gte: range.start, $lt: range.end } }).maxTimeMS(8000),
    ]);
    const groups = [['Resources', resources], ['Study Sets', sets], ['Study reports', reports], ['Session issues', sessions], ['Circle reports', circles]];
    const queue = groups.map(([label, rows]) => ({ label, value: rows.reduce((sum, row) => sum + row.count, 0) }));
    const aging = ['0-1 days', '2-3 days', '4-7 days', '8+ days', 'unknown'].map(label => ({ label, value: groups.reduce((sum, [, rows]) => sum + (rows.find(row => row._id === label)?.count || 0), 0) }));
    const outcomes = ['approved', 'rejected', 'other'].map(label => ({ label, value: decisions.filter(row => row._id.outcome === label).reduce((sum, row) => sum + row.count, 0) }));
    const approved = outcomes[0].value, rejected = outcomes[1].value;
    res.json({ success: true, data: { ...rangeDto(range), snapshotAt: now, queue, aging, outcomes,
      pendingQueue: queue.reduce((sum, row) => sum + row.value, 0), reviewDecisions: outcomes.reduce((sum, row) => sum + row.value, 0),
      approvalRate: approved + rejected ? Math.round(approved * 1000 / (approved + rejected)) / 10 : null,
      reportsCreated: reportCount, sessionIssues: queue[3].value,
      trend: decisions.map(row => ({ date: row._id.date, outcome: row._id.outcome, count: row.count })) } });
  } catch { res.status(503).json({ success: false, message: 'Moderation analytics could not be loaded. Please retry.' }); }
};
