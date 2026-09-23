const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isValidObjectId } = require('./validation');
const { logSecurityEvent } = require('../utils/securityLogger');

// Authentication: confirms WHO the user is by validating their JWT.
async function authenticateToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token required' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    logSecurityEvent('auth.token_rejected', req, { status: 401 });
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  if (!isValidObjectId(payload.id)) {
    logSecurityEvent('auth.token_rejected', req, { status: 401 });
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  try {
    // The database is authoritative for authorization. A role change takes
    // effect on the next protected request even when the JWT is still valid.
    const user = await User.findById(payload.id)
      .select('_id name email role credits')
      .lean();

    if (!user) {
      return res.status(401).json({ success: false, message: 'Account is no longer available' });
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      credits: user.credits,
    };
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to verify account access' });
  }
}

// Authorization: confirms WHAT an already-authenticated user is allowed to do.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      logSecurityEvent('access.role_denied', req, { status: 403 });
      return res.status(403).json({ success: false, message: 'You do not have permission to perform this action' });
    }
    next();
  };
}

module.exports = { authenticateToken, requireRole };
