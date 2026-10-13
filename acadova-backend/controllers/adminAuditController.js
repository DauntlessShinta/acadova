const AuditLog = require('../models/AuditLog');
const { auditFilters } = require('../utils/auditFilters');
const { aggregate } = require('../utils/analyticsWindow');
const User = require('../models/User');
const { escapeRegExp } = require('../middleware/validation');
const mongoose = require('mongoose');

exports.listAuditLogs = async (req, res) => {
  let parsed;
  try { parsed = auditFilters(req.query); }
  catch { return res.status(400).json({ success: false, message: 'Invalid audit filter or pagination.' }); }
  if (parsed.enhanced) {
    try {
      const { filter, page, limit, q } = parsed;
      if (filter.actor) filter.actor = new mongoose.Types.ObjectId(filter.actor);
      const fields = ['reason', 'suspensionReason', 'direction', 'amount', 'reference', 'creditCost', 'previousRole', 'newRole', 'hidden', 'resolution', 'previousStatus', 'newStatus', 'beforeVersion', 'afterVersion'];
      const pipeline = [{ $match: filter }, { $project: { actor: 1, actorRole: 1, action: 1,
        targetType: 1, targetId: 1, summary: 1, createdAt: 1,
        ...Object.fromEntries(fields.map(key => ['metadata.' + key, 1])) } },
      { $lookup: { from: User.collection.name, let: { actorId: '$actor' }, pipeline: [
        { $match: { $expr: { $eq: ['$_id', '$$actorId'] } } }, { $project: { name: 1 } },
      ], as: 'actor' } }, { $set: { actor: { $arrayElemAt: ['$actor', 0] } } }];
      if (q) pipeline.push({ $match: { $or: ['action', 'summary', 'targetId', 'actor.name']
        .map(field => ({ [field]: { $regex: escapeRegExp(q), $options: 'i' } })) } });
      pipeline.push({ $facet: { rows: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }], count: [{ $count: 'total' }] } });
      const [result] = await aggregate(AuditLog, pipeline);
      return res.json({ success: true, data: result?.rows || [], pagination: { page, limit, total: result?.count?.[0]?.total || 0 } });
    } catch { return res.status(503).json({ success: false, message: 'Audit logs unavailable.' }); }
  }
  const { filter, page, limit } = parsed;
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
