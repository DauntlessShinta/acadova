// Simple fixed-window rate limiter keyed by IP, kept dependency-free on purpose.
// Good enough for a single-instance college project; not meant for multi-server deployment.
function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map(); // ip -> { count, windowStart }

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const record = hits.get(key);

    if (!record || now - record.windowStart > windowMs) {
      hits.set(key, { count: 1, windowStart: now });
      return next();
    }

    if (record.count >= max) {
      return res.status(429).json({ success: false, message: message || 'Too many requests, please try again later' });
    }

    record.count += 1;
    next();
  };
}

module.exports = { createRateLimiter };
