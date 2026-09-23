const { createRateLimiter } = require('./rateLimiter');

const accountKey = (req) => req.user?.id || req.ip;
const limitedMessage = 'Too many changes, please try again later';

const sessionCreationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, max: 10, keyForRequest: accountKey, message: limitedMessage,
});
const sessionActionLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, max: 60, keyForRequest: accountKey, message: limitedMessage,
});
const messageLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, max: 60, keyForRequest: accountKey, message: 'Too many messages, please try again later',
});
const ratingLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, max: 10, keyForRequest: accountKey, message: limitedMessage,
});
const staffActionLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, max: 30, keyForRequest: accountKey, message: limitedMessage,
});

module.exports = {
  sessionCreationLimiter, sessionActionLimiter, messageLimiter, ratingLimiter, staffActionLimiter,
};
