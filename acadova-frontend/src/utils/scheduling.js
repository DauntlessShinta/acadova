// Wall-clock input is interpreted in an explicit IANA zone, never the server zone.
export const deviceTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const fail = (field, message) => { throw Object.assign(new Error(message), { field }); };
const formatters = new Map();
function formatter(zone) {
  if (!formatters.has(zone)) {
    if (formatters.size > 20) formatters.clear();
    try { formatters.set(zone, new Intl.DateTimeFormat('en-CA', { timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' })); }
    catch { fail('timezone', 'Choose a valid IANA timezone.'); }
  }
  return formatters.get(zone);
}
const parts = (value, zone) => Object.fromEntries(formatter(zone).formatToParts(new Date(value)).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
const stamp = p => Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second || 0);
const pad = value => String(value).padStart(2, '0');
export function localFields(value, zone = deviceTimezone()) {
  const p = parts(value, zone);
  return { date:`${p.year}-${pad(p.month)}-${pad(p.day)}`, time:`${pad(p.hour)}:${pad(p.minute)}` };
}
export function wallTimeToInstant(value, zone = deviceTimezone()) {
  const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) fail('time', 'Enter a valid date and start time.');
  const [year, month, day, hour, minute, second] = match.slice(1).map(n => Number(n || 0));
  const wall = Date.UTC(year, month - 1, day, hour, minute, second), d = new Date(wall);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59 || d.getUTCFullYear() !== year || d.getUTCMonth()+1 !== month || d.getUTCDate() !== day) fail('date', 'Choose a valid calendar date and time.');
  // Candidate offsets on both sides of a transition; matching the original wall
  // clock detects gaps and folds, including non-hour transitions, without guessing.
  const offsets = new Set();
  for (let h = -36; h <= 36; h += 6) { const at = wall + h * 3600000; offsets.add(stamp(parts(at, zone)) - at); }
  const matches = [...offsets].map(offset => wall-offset).filter(at => stamp(parts(at, zone)) === wall);
  if (!matches.length) fail('time', 'This local time does not exist because the clocks change. Choose another time.');
  if (matches.length > 1) fail('time', 'This local time occurs twice because the clocks change. Choose an unambiguous time.');
  return new Date(matches[0]).toISOString();
}
export function requireFutureStart(instant, now = Date.now(), horizonDays) {
  const start = Date.parse(instant);
  if (!Number.isFinite(start)) fail('time', 'Enter a valid date and start time.');
  if (start <= now) fail('time', 'The start time has already passed. Select a new time.');
  if (horizonDays && start > now + horizonDays * 86400000) fail('date', `Choose a start date within the next ${horizonDays} days.`);
  return instant;
}
export function scheduleLabel(instant, zone) {
  return new Intl.DateTimeFormat(undefined, { timeZone:zone, dateStyle:'medium', timeStyle:'short' }).format(new Date(instant));
}
export function circleSchedule(draft, { existing, now = Date.now(), validateFuture = true } = {}) {
  const zone = draft.timezone;
  const original = existing && localFields(existing.startsAt, existing.timezone);
  const oldDuration = existing && (Date.parse(existing.endsAt) - Date.parse(existing.startsAt)) / 60000;
  const unchanged = existing && draft.date === original.date && draft.time === original.time && Number(draft.durationMinutes) === oldDuration && zone === existing.timezone;
  // Exact existing instants (including seconds/fold offsets) survive metadata-only
  // edits. Changing a schedule requires the new bounds and unambiguous input.
  const startsAt = unchanged ? new Date(existing.startsAt).toISOString() : wallTimeToInstant(`${draft.date}T${draft.time}`, zone);
  if (validateFuture) requireFutureStart(startsAt, now, 180);
  const durationMinutes = Number(draft.durationMinutes);
  if (!unchanged && (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 180)) fail('duration', 'Study circles must last between 30 minutes and 3 hours.');
  const endsAt = unchanged ? new Date(existing.endsAt).toISOString() : new Date(Date.parse(startsAt) + durationMinutes * 60000).toISOString();
  return { startsAt, endsAt, timezone:zone, durationMinutes, startLabel:scheduleLabel(startsAt, zone), endLabel:scheduleLabel(endsAt, zone) };
}

export function minimumLocalDateTime(now = Date.now()) { const p=localFields(now+60000);return p.date+'T'+p.time; }
