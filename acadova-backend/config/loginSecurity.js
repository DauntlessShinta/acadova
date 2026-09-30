// Account cooldown complements the existing 20-per-15-minute IP limiter.
const failureThreshold = 3;
const baseCooldownSeconds = 15;
const maxCooldownSeconds = 300;
const failureWindowHours = 24;

const cooldownSecondsFor = (attempts) => attempts < failureThreshold ? 0
  : Math.min(maxCooldownSeconds, baseCooldownSeconds * 2 ** (attempts - failureThreshold));

module.exports = { failureThreshold, baseCooldownSeconds, maxCooldownSeconds,
  failureWindowHours, cooldownSecondsFor };
