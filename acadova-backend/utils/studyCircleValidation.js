const { InvalidInput, schemas } = require('../middleware/validation');
const { parse, objectId } = require('./academicValidation');
const text = (max, empty = false) => value => { if (typeof value !== 'string' || value.trim().length > max || !empty && !value.trim() || /[\u0000-\u001f\u007f]/.test(value)) throw new InvalidInput(`Use ${empty ? 'up to' : '1 to'} ${max} characters.`); return value.trim(); };
const optional = fn => v => v === undefined ? undefined : fn(v);
const version = v => { if (!Number.isSafeInteger(v) || v < 1) throw new InvalidInput('Refresh the current version.'); return v; };
function meetingUrl(value) {
  const clean = text(500)(value); let url; try { url = new URL(clean); } catch { throw new InvalidInput('Use a supported HTTPS meeting link.'); }
  const safe = url.hostname === 'meet.google.com' && /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(url.pathname)
    || /^(?:[a-z0-9-]+\.)?zoom\.us$/.test(url.hostname) && /^\/(?:j|my)\/[A-Za-z0-9._-]+\/?$/.test(url.pathname)
    || ['teams.microsoft.com', 'teams.live.com'].includes(url.hostname) && url.pathname.startsWith('/meet/');
  if (!safe || url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || /[\s\\]/.test(clean)) throw new InvalidInput('Use a Google Meet, Zoom or Teams HTTPS meeting link without credentials or a custom port.');
  // Bookmarks cannot carry redirect/tracking parameters or duplicate passcodes.
  const keys = [...url.searchParams.keys()]; const allowed = url.hostname.endsWith('zoom.us') ? 'pwd' : 'p';
  if (keys.length > 1 || keys.some(key => key !== allowed) || keys.length && !/^[A-Za-z0-9._~-]{1,200}$/.test(url.searchParams.get(allowed))) throw new InvalidInput('Use a plain meeting bookmark with only its optional meeting passcode.');
  if (url.hostname === 'meet.google.com' && url.search) throw new InvalidInput('Use the plain Google Meet bookmark without query parameters.');
  return url.href;
}
const timezone = v => { const value = text(80)(v); try { if (!/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/.test(value)) throw new Error(); new Intl.DateTimeFormat('en', { timeZone: value }); } catch { throw new InvalidInput('Choose a valid IANA timezone.'); } return value; };
const fields = { title: text(120), description: optional(text(600, true)), tags: optional(v => { if (!Array.isArray(v) || v.length > 5) throw new InvalidInput('Choose up to five tags.'); return [...new Set(v.map(text(40)))]; }),
  startsAt: schemas.session.scheduledAt, endsAt: schemas.session.scheduledAt, timezone,
  capacity: optional(v => { if (!Number.isSafeInteger(v) || v < 1 || v > 50) throw new InvalidInput('Capacity must be 1 to 50 attendees, excluding the host.'); return v; }),
  subjectId: optional(v => v === null ? null : objectId(v)), meetingUrl };
function circleInput(body) { const clean = parse(body, fields); const start = new Date(clean.startsAt), end = new Date(clean.endsAt), now = Date.now();
  if (start <= now || start > now + 180 * 86400000 || end <= start || end - start > 8 * 3600000) throw new InvalidInput('Start within the next 180 days and finish within eight hours after starting.'); return clean;
}
const volunteer = { enabled: v => { if (typeof v !== 'boolean') throw new InvalidInput('Use true or false.'); return v; }, expertise: text(300, true), interests: text(300, true) };
module.exports = { circleInput, meetingUrl, timezone, version, volunteer, text, optional };
