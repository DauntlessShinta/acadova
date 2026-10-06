const User = require('../models/User');
const Rating = require('../models/Rating');
const { isValidObjectId, escapeRegExp } = require('../middleware/validation');
const mongoose = require('mongoose');
const { availableStudentFilter } = require('../utils/peerEligibility');
const { publicReputation, reputationStages } = require('../utils/ratingReputation');

// GET /api/users/me - the logged-in user's own profile.
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -failedLoginAttempts -lastFailedLoginAt -loginCooldownUntil');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const profile = user.toObject ? user.toObject() : user;
    const reputation = user.role === 'student' ? await publicReputation(user._id) : {};
    res.json({ success: true, message: 'Profile retrieved', data: { ...profile, ...reputation } });
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

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true })
      .select('-password -failedLoginAttempts -lastFailedLoginAt -loginCooldownUntil');
    res.json({ success: true, message: 'Profile updated', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while updating profile' });
  }
};

// GET /api/users/tutors?subject=Java - tutor discovery for the matching hub.
exports.searchTutors = async (req, res) => {
  try {
    const { subject } = req.validatedQuery;
    const filter = {
      ...availableStudentFilter(),
      _id: { $ne: new mongoose.Types.ObjectId(req.user.id) },
      skillsToTeach: subject
        ? { $regex: escapeRegExp(subject), $options: 'i' }
        : { $exists: true, $ne: [] },
    };

    const tutors = await User.aggregate([
      { $match: filter }, ...reputationStages(),
      { $sort: { rating: -1, ratingCount: -1, _id: 1 } }, { $limit: 50 },
      { $project: { name: 1, skillsToTeach: 1, rating: 1, ratingCount: 1, role: 1 } },
    ]);

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

    const user = await User.findOne({ _id: id, ...availableStudentFilter() })
      .select('name rating skillsToTeach skillsToLearn role createdAt');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Peer profile not found' });
    }

    const profile = user.toObject ? user.toObject() : user;
    res.json({ success: true, message: 'User profile retrieved', data: { ...profile, ...await publicReputation(id) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while retrieving user profile' });
  }
};

exports.finishOnboarding = async (req, res) => {
  try {
    const updated = await User.findOneAndUpdate(
      { _id: req.user.id, role: 'student', onboardingFinishedAt: null },
      { $set: { onboardingFinishedAt: new Date() } }, { new: true, runValidators: true })
      .select('-password -failedLoginAttempts -lastFailedLoginAt -loginCooldownUntil');
    const user = updated || await User.findOne({ _id: req.user.id, role: 'student' })
      .select('-password -failedLoginAttempts -lastFailedLoginAt -loginCooldownUntil');
    return user ? res.json({ success: true, data: user })
      : res.status(404).json({ success: false, message: 'Student account not found.' });
  } catch { return res.status(500).json({ success: false, message: 'Setup could not be saved.' }); }
};

exports.getUserReviews = async (req, res) => {
  try {
    const peer = await User.exists({ _id: req.params.id, ...availableStudentFilter() });
    if (!peer) return res.status(404).json({ success: false, message: 'Peer profile not found' });
    const rows = await Rating.find({ toUser: req.params.id, isHidden: { $ne: true } })
      .select('rating comment fromUser createdAt').populate('fromUser', 'name')
      .sort({ createdAt: -1 }).limit(20).lean();
    return res.json({ success: true, data: rows.map((row) => ({
      id: String(row._id), rating: row.rating, comment: row.comment || '',
      reviewerName: row.fromUser?.name || 'Acadova Student', createdAt: row.createdAt,
    })) });
  } catch {
    return res.status(500).json({ success: false, message: 'Reviews could not be loaded.' });
  }
};
