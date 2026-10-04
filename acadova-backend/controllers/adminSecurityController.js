const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { ACTIONS } = require('../services/auditService');
const { isValidObjectId } = require('../middleware/validation');

const actions = [ACTIONS.loginCooldownStarted, ACTIONS.loginCooldownExtended,
  ACTIONS.loginSuccessAfterFailures, ACTIONS.suspendedLoginAttempt];
const categories = {
  all: actions,
  cooldown: [ACTIONS.loginCooldownStarted, ACTIONS.loginCooldownExtended],
  login: [ACTIONS.loginSuccessAfterFailures],
  suspension: [ACTIONS.suspendedLoginAttempt],
};

exports.getSecurityOverview = async (req, res) => {
  const { period = '24h', category = 'all', account } = req.query;
  if (!['24h', '7d'].includes(period) || !Object.hasOwn(categories, category)
    || (account && !isValidObjectId(account))
    || Object.keys(req.query).some((key) => !['period', 'category', 'account'].includes(key))) {
    return res.status(400).json({ success: false, message: 'Invalid security filter.' });
  }
  const now = new Date();
  const since = new Date(now.getTime() - (period === '7d' ? 7 : 1) * 24 * 60 * 60 * 1000);
  const filter = { action: { $in: categories[category] }, createdAt: { $gte: since },
    ...(account ? { targetType: 'User', targetId: account } : {}) };
  const lastDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  try {
    const [rows, cooldowns, starts, extensions, recovered, suspendedAttempts] = await Promise.all([
      AuditLog.find(filter).select('action targetType targetId summary createdAt actorRole')
        .sort({ createdAt: -1, _id: -1 }).limit(100).lean(),
      User.countDocuments({ loginCooldownUntil: { $gt: now } }),
      AuditLog.countDocuments({ action: ACTIONS.loginCooldownStarted, createdAt: { $gte: lastDay } }),
      AuditLog.countDocuments({ action: ACTIONS.loginCooldownExtended, createdAt: { $gte: lastDay } }),
      AuditLog.countDocuments({ action: ACTIONS.loginSuccessAfterFailures, createdAt: { $gte: lastDay } }),
      AuditLog.countDocuments({ action: ACTIONS.suspendedLoginAttempt, createdAt: { $gte: lastDay } }),
    ]);
    return res.json({ success: true, data: {
      counts: { activeCooldowns: cooldowns, cooldownStarted: starts,
        cooldownExtended: extensions, recoveredLogins: recovered, suspendedAttempts },
      events: rows.map((row) => ({ id: String(row._id), action: row.action,
        accountId: row.targetType === 'User' ? row.targetId : null, createdAt: row.createdAt })),
      period, category,
    } });
  } catch { return res.status(503).json({ success: false, message: 'Security activity unavailable.' }); }
};
