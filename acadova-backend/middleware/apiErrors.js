const { logSecurityEvent } = require('../utils/securityLogger');

function apiNotFound(req, res) {
  return res.status(404).json({ success: false, message: 'API route not found' });
}

function notFound(req, res) {
  return res.status(404).json({ success: false, message: 'Route not found' });
}

function unexpectedError(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err.code === 'CORS_ORIGIN_DENIED') {
    return res.status(403).json({ success: false, message: 'Origin not allowed' });
  }
  logSecurityEvent('server.unexpected_error', req, { status: 500 });
  return res.status(500).json({ success: false, message: 'Unexpected server error' });
}

module.exports = { apiNotFound, notFound, unexpectedError };
