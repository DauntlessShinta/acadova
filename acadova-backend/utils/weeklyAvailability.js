const minute = (value) => {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Use a 24-hour HH:mm time.');
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
};
function validateAvailability(value) {
  if (value === null) return null;
  if (!value || Array.isArray(value) || Object.keys(value).some((key) => !['timezone', 'ranges'].includes(key))) throw new Error('Availability needs a timezone and weekly ranges.');
  if (typeof value.timezone !== 'string' || value.timezone.length > 80) throw new Error('Select a valid IANA timezone, such as Asia/Manila.');
  let timezone;
  try { timezone = new Intl.DateTimeFormat('en', { timeZone: value.timezone }).resolvedOptions().timeZone; }
  catch { throw new Error('Select a valid IANA timezone, such as Asia/Manila.'); }
  if (!Array.isArray(value.ranges) || value.ranges.length > 21) throw new Error('Use at most three ranges per day.');
  const ranges = value.ranges.map((range) => {
    if (!range || Object.keys(range).some((key) => !['day', 'start', 'end'].includes(key)) || !Number.isInteger(range.day) || range.day < 0 || range.day > 6) throw new Error('Choose a valid weekday for every range.');
    if (minute(range.start) >= minute(range.end)) throw new Error('End time must be after start time on the same day; split overnight hours across days.');
    return { day: range.day, start: range.start, end: range.end };
  }).sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  for (let day = 0; day <= 6; day++) {
    const items = ranges.filter((range) => range.day === day);
    if (items.length > 3 || items.some((range, i) => i && range.start < items[i - 1].end)) throw new Error('Use at most three non-overlapping ranges per day.');
  }
  return { timezone, ranges };
}
module.exports = { validateAvailability };
