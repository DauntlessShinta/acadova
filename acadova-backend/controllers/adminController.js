const User = require('../models/User');
const Session = require('../models/Session');
const { isValidObjectId } = require('../middleware/validation');
const { logSecurityEvent } = require('../utils/securityLogger');

const MANAGEABLE_ROLES = new Set(['student', 'moderator']);

// GET /api/admin/users - lists platform accounts for user management.
exports.listUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('name email role credits rating skillsToTeach skillsToLearn createdAt')
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
      .select('subject learner tutor scheduledAt status confirmedAt creditAmount createdAt')
      .populate('learner', 'name')
      .populate('tutor', 'name')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, message: 'Sessions retrieved', data: sessions });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Sessions could not be loaded.' });
  }
};

// PATCH /api/admin/users/:id/role - manages only student/moderator access.
exports.updateUserRole = async (req, res) => {
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

    const target = await User.findById(id).select('_id role');
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (target.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admin roles cannot be changed through this endpoint' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { role },
      { returnDocument: 'after', runValidators: true }
    ).select('name email role credits rating skillsToTeach skillsToLearn createdAt');
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    logSecurityEvent('admin.role_changed', req, { targetId: id, newRole: role });

    return res.json({ success: true, message: `User role updated to ${role}`, data: updatedUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error while updating user role' });
  }
};
