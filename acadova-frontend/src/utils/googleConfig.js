export const isGoogleClientConfigured = (value) =>
  typeof value === 'string' && /^\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(value.trim());

export const googleMeetHome = 'https://meet.google.com/';
