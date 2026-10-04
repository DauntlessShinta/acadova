const User = require('../models/User');
const { failureThreshold, baseCooldownSeconds, maxCooldownSeconds,
  failureWindowHours, cooldownSecondsFor } = require('../config/loginSecurity');

const cooldownExpired = (now) => ({ $or: [
  { loginCooldownUntil: null }, { loginCooldownUntil: { $lte: now } },
] });

async function recordFailedLogin(user, now = new Date()) {
  const activeWindow = new Date(now.getTime() - failureWindowHours * 60 * 60 * 1000);
  const previous = { $cond: [
    { $gte: ['$lastFailedLoginAt', activeWindow] },
    { $ifNull: ['$failedLoginAttempts', 0] }, 0,
  ] };
  const next = { $add: [previous, 1] };
  const duration = { $min: [maxCooldownSeconds,
    { $multiply: [baseCooldownSeconds,
      { $pow: [2, { $min: [5, { $subtract: [next, failureThreshold] }] }] }] }] };
  // One document, one atomic update: concurrent failures cannot lose increments
  // or replace a longer cooldown with an older, shorter calculation.
  const updated = await User.findOneAndUpdate({ _id: user._id, password: user.password,
    ...cooldownExpired(now) }, [{ $set: {
      failedLoginAttempts: next,
      lastFailedLoginAt: now,
      loginCooldownUntil: { $cond: [
        { $gte: [next, failureThreshold] },
        { $dateAdd: { startDate: now, unit: 'second', amount: { $toLong: duration } } },
        null,
      ] },
    } }], { new: true }).select('+failedLoginAttempts +loginCooldownUntil');
  if (!updated) return null;
  const count = updated.failedLoginAttempts;
  return { count, cooldownSeconds: cooldownSecondsFor(count) };
}

async function resetAfterSuccess(user, now = new Date()) {
  return User.findOneAndUpdate({ _id: user._id, password: user.password,
    suspendedAt: null, emailVerified: { $ne: false }, ...cooldownExpired(now) },
  { $set: { failedLoginAttempts: 0 },
    $unset: { loginCooldownUntil: 1, lastFailedLoginAt: 1 } }, { new: true, select: '+authVersion' });
}

module.exports = { recordFailedLogin, resetAfterSuccess, cooldownExpired };
