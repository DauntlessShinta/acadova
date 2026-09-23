const { logSecurityEvent } = require('../utils/securityLogger');

// Simple fixed-window rate limiter, kept dependency-free on purpose.
// Good enough for a single-instance college project; not meant for multi-server deployment.
function createRateLimiter({ windowMs, max, message, keyForRequest = (req) => req.ip }) {
  const hits = new Map(); // key -> { count, windowStart }

  return (req, res, next) => {
    const key = keyForRequest(req);
    const now = Date.now();
    const record = hits.get(key);

    if (!record || now - record.windowStart > windowMs) {
      hits.set(key, { count: 1, windowStart: now });
      return next();
    }

    if (record.count >= max) {
      logSecurityEvent('rate_limit.exceeded', req, { status: 429, sourceIp: req.ip });
      return res.status(429).json({ success: false, message: message || 'Too many requests, please try again later' });
    }

    record.count += 1;
    next();
  };
}

module.exports = { createRateLimiter };
