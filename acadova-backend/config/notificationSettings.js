const minutes = (name, fallback, maximum) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 1 && value <= maximum ? value : fallback;
};

module.exports = {
  messagePushCooldownMinutes: minutes('MESSAGE_PUSH_COOLDOWN_MINUTES', 5, 60),
  unreadReminderMinutes: minutes('UNREAD_REMINDER_MINUTES', 30, 1440),
  sessionReminderMinutes: minutes('SESSION_REMINDER_MINUTES', 45, 180),
};
