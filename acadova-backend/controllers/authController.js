const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { isValidEmail, isValidPassword } = require('../middleware/validation');

function signToken(user) {
  // Token payload stays minimal: never put passwords or extra PII in a JWT.
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, credits: user.credits, role: user.role };
}

exports.register = async (req, res) => {
  try {
    // Note: "role" is intentionally not read from req.body. Every new
    // account is a "student" by default (see User model) so a client can
    // never self-promote to moderator or admin during registration.
    const { name, email, password, skillsToTeach, skillsToLearn } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'A valid email is required' });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      skillsToTeach: Array.isArray(skillsToTeach) ? skillsToTeach : [],
      skillsToLearn: Array.isArray(skillsToLearn) ? skillsToLearn : [],
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { token: signToken(user), user: publicUser(user) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Generic message on every failure path below - never reveal whether
    // the account exists or which field (email vs password) was wrong.
    const genericFailure = () => res.status(401).json({ success: false, message: 'Invalid email or password' });

    if (!email || !password) return genericFailure();

    const user = await User.findOne({ email });
    if (!user) return genericFailure();

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return genericFailure();

    res.json({
      success: true,
      message: 'Login successful',
      data: { token: signToken(user), user: publicUser(user) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};
