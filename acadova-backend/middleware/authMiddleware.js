const jwt = require('jsonwebtoken');

// Authentication: confirms WHO the user is by validating their JWT.
function authenticateToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Keep the token payload minimal (id, role) so we never carry sensitive data through requests.
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// Authorization: confirms WHAT an already-authenticated user is allowed to do.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to perform this action' });
    }
    next();
  };
}

module.exports = { authenticateToken, requireRole };
