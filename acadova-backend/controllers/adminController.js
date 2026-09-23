const User = require('../models/User');
const { isValidObjectId } = require('../middleware/validation');

const MANAGEABLE_ROLES = new Set(['student', 'moderator']);

// GET /api/admin/users - lists all platform users for the admin dashboard.
// Read-only by design: no ban/promote actions yet (not part of current scope).
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

    return res.json({ success: true, message: `User role updated to ${role}`, data: updatedUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error while updating user role' });
  }
};
