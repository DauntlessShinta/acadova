const User = require('../models/User');
const { isValidObjectId } = require('../middleware/validation');

// GET /api/users/me - the logged-in user's own profile.
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'Profile retrieved', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while retrieving profile' });
  }
};

// PATCH /api/users/me - update own profile. Deliberately whitelisted: a
// user can change their name and skills, but never email, password, role,
// credits, or rating through this endpoint (those need their own flows).
exports.updateMe = async (req, res) => {
  try {
    const { name, skillsToTeach, skillsToLearn } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Name must be a non-empty string' });
      }
      updates.name = name.trim();
    }
    if (skillsToTeach !== undefined) {
      if (!Array.isArray(skillsToTeach) || !skillsToTeach.every((s) => typeof s === 'string')) {
        return res.status(400).json({ success: false, message: 'skillsToTeach must be an array of strings' });
      }
      updates.skillsToTeach = skillsToTeach;
    }
    if (skillsToLearn !== undefined) {
      if (!Array.isArray(skillsToLearn) || !skillsToLearn.every((s) => typeof s === 'string')) {
        return res.status(400).json({ success: false, message: 'skillsToLearn must be an array of strings' });
      }
      updates.skillsToLearn = skillsToLearn;
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true }).select('-password');
    res.json({ success: true, message: 'Profile updated', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while updating profile' });
  }
};

// GET /api/users/tutors?subject=Java - tutor discovery for the matching hub.
exports.searchTutors = async (req, res) => {
  try {
    const { subject } = req.query;
    const filter = subject
      ? { skillsToTeach: { $regex: subject, $options: 'i' } }
      : { skillsToTeach: { $exists: true, $ne: [] } };

    const tutors = await User.find(filter)
      .select('name skillsToTeach rating')
      .sort({ rating: -1 })
      .limit(50);

    res.json({ success: true, message: 'Tutors retrieved', data: tutors });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while searching tutors' });
  }
};

// GET /api/users/:id - get tutor / user public profile by ID.
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    const user = await User.findById(id).select('name rating skillsToTeach skillsToLearn createdAt');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User profile retrieved', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while retrieving user profile' });
  }
};
