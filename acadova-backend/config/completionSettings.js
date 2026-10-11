const hours = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 1 && value <= 168 ? value : fallback;
};
module.exports = { completionSettings: () => ({
  deadlineHours: hours('SESSION_VALIDATION_DEADLINE_HOURS', 72),
  staffTargetHours: hours('SESSION_REVIEW_TARGET_HOURS', 48),
}) };
