const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

const calendarBase = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

function validMeetUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'meet.google.com'
      && !url.username && !url.password && /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/.test(url.pathname);
  } catch { return false; }
}

async function googleJson(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: 'Bearer ' + accessToken,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Google provider request failed');
  return response.json();
}

async function verifyCalendarIdentity(accessToken, account) {
  const identity = await googleJson('https://www.googleapis.com/oauth2/v3/userinfo', accessToken);
  if (identity?.email_verified !== true || typeof identity.sub !== 'string') return false;
  if (account.googleSub) return identity.sub === account.googleSub;
  return identity.email?.toLowerCase() === account.email?.toLowerCase();
}

async function createGoogleMeet({ accessToken, subject, scheduledAt }) {
  const start = new Date(scheduledAt);
  if (Number.isNaN(start.getTime())) throw new Error('Session has no valid schedule');
  const event = await googleJson(calendarBase + '?conferenceDataVersion=1', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      summary: 'Acadova tutoring: ' + subject,
      start: { dateTime: start.toISOString() },
      end: { dateTime: new Date(start.getTime() + 60 * 60 * 1000).toISOString() },
      conferenceData: { createRequest: {
        requestId: randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' },
      } },
    }),
  });
  let link = event?.hangoutLink
    || event?.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri;
  if (!link && event?.id) {
    for (let attempt = 0; attempt < 3 && !link; attempt += 1) {
      await delay(500);
      const current = await googleJson(calendarBase + '/' + encodeURIComponent(event.id), accessToken);
      link = current?.hangoutLink
        || current?.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri;
    }
  }
  if (!validMeetUrl(link)) throw new Error('Google Meet link was not returned');
  return link;
}

module.exports = { verifyCalendarIdentity, createGoogleMeet, validMeetUrl };
