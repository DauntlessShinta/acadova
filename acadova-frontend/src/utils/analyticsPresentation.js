const DAY = 86400000;
export const dateString = value => new Date(value).toISOString().slice(0, 10);
export function recentRange(days, now = new Date()) {
  const end = new Date(dateString(now) + 'T00:00:00Z');
  return { from: dateString(end.getTime() - (days - 1) * DAY), to: dateString(end) };
}
export function rangeError({ from, to }) {
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && dateString(value) === value;
  if (!valid(from) || !valid(to)) return 'Choose valid From and To dates.';
  const duration = Date.parse(to) - Date.parse(from);
  return duration < 0 || duration >= 366 * DAY ? 'Choose an ordered range of at most 366 days.' : '';
}
export function dailyActivity(requests, payments, range) {
  if (rangeError(range)) return [];
  const first = new Map(requests.map(row => [row._id, row.count]));
  const second = new Map(payments.map(row => [row._id, row.count]));
  const rows = [];
  for (let at = Date.parse(range.from); at <= Date.parse(range.to); at += DAY) {
    const date = dateString(at);
    rows.push({ date, requests: first.get(date) || 0, payments: second.get(date) || 0 });
  }
  return rows;
}
