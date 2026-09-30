const AuditLog = require('../models/AuditLog');
const { ACTIONS } = require('../services/auditService');
const { isValidObjectId } = require('../middleware/validation');

exports.listAuditLogs = async (req, res) => {
  const { page = '1', limit = '25', action, actor, targetType } = req.query;
  if (Object.keys(req.query).some((key) => !['page', 'limit', 'action', 'actor', 'targetType'].includes(key))
    || !/^[1-9]\d*$/.test(page) || !/^[1-9]\d*$/.test(limit)
    || Number(limit) > 100 || Number(page) > 10000
    || (action && !Object.values(ACTIONS).includes(action))
    || (actor && !isValidObjectId(actor))
    || (targetType && !['Session', 'CreditConfig', 'CreditTransaction', 'LearningTopic',
      'LearningResource', 'LearningModule', 'Assessment', 'Rating', 'User'].includes(targetType))) {
    return res.status(400).json({ success: false, message: 'Invalid audit filter or pagination.' });
  }
  const filter = { ...(action ? { action } : {}), ...(actor ? { actor } : {}),
    ...(targetType ? { targetType } : {}) };
  try {
    const [total, rows] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter).select('actor actorRole action targetType targetId summary metadata createdAt')
        .sort({ createdAt: -1, _id: -1 }).skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit)).populate('actor', 'name').lean(),
    ]);
    return res.json({ success: true, data: rows, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch {
    return res.status(503).json({ success: false, message: 'Audit logs unavailable.' });
  }
};
