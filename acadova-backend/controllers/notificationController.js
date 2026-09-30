const Notification = require('../models/Notification');
const { isValidObjectId } = require('../middleware/validation');
const { linkFor, pushAliasFor } = require('../services/notificationService');

const present = (row) => ({ id: String(row._id), type: row.type, title: row.title,
  message: row.message, createdAt: row.createdAt, readAt: row.readAt,
  href: linkFor(row) });

exports.pushIdentity = (req, res) => {
  const alias = process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY
    ? pushAliasFor(req.user.id) : null;
  return res.json({ success: true, data: { enabled: Boolean(alias), alias } });
};

exports.listMine = async (req, res) => {
  const { page = '1', limit = '20', unread = 'false' } = req.query;
  if (Object.keys(req.query).some((key) => !['page', 'limit', 'unread'].includes(key))
    || typeof page !== 'string' || typeof limit !== 'string' || typeof unread !== 'string'
    || !/^[1-9]\d*$/.test(page) || !/^[1-9]\d*$/.test(limit)
    || Number(page) > 10000 || Number(limit) > 50 || !['true', 'false'].includes(unread)) {
    return res.status(400).json({ success: false, message: 'Invalid notification query.' });
  }
  const filter = { recipient: req.user.id, ...(unread === 'true' ? { readAt: null } : {}) };
  try {
    const [total, rows] = await Promise.all([
      Notification.countDocuments(filter), Notification.find(filter)
        .select('type title message relatedType relatedId readAt createdAt')
        .sort({ createdAt: -1, _id: -1 }).skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit)).lean(),
    ]);
    return res.json({ success: true, data: rows.map(present),
      pagination: { page: Number(page), limit: Number(limit), total } });
  } catch { return res.status(503).json({ success: false, message: 'Notifications unavailable.' }); }
};

exports.unreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user.id, readAt: null });
    return res.json({ success: true, data: { count } });
  } catch { return res.status(503).json({ success: false, message: 'Notifications unavailable.' }); }
};

exports.markRead = async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid notification id.' });
  try {
    const row = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user.id,
      readAt: null }, { $set: { readAt: new Date() } }, { returnDocument: 'after' }).lean();
    if (row) return res.json({ success: true, data: present(row) });
    const owned = await Notification.findOne({ _id: req.params.id, recipient: req.user.id })
      .select('type title message relatedType relatedId readAt createdAt').lean();
    return owned ? res.json({ success: true, data: present(owned) })
      : res.status(404).json({ success: false, message: 'Notification not found.' });
  } catch { return res.status(503).json({ success: false, message: 'Notification could not be updated.' }); }
};

exports.markAllRead = async (req, res) => {
  try {
    const result = await Notification.updateMany({ recipient: req.user.id, readAt: null },
      { $set: { readAt: new Date() } });
    return res.json({ success: true, data: { updated: result.modifiedCount } });
  } catch { return res.status(503).json({ success: false, message: 'Notifications could not be updated.' }); }
};
