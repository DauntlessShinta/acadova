const User = require('../models/User');

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
