import { isGoogleClientConfigured } from '../utils/googleConfig';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const calendarScope = 'openid email https://www.googleapis.com/auth/calendar.events';

export function loadGoogleCalendarAuthorization() {
  if (!isGoogleClientConfigured(clientId)) return Promise.reject(new Error('Google authorization unavailable'));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let script = document.querySelector('script[data-acadova-google]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.dataset.acadovaGoogle = 'true';
      document.head.appendChild(script);
    }
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Google authorization unavailable')), { once: true });
  });
}

export function requestGoogleCalendarAccess() {
  if (!window.google?.accounts?.oauth2 || !isGoogleClientConfigured(clientId)) {
    return Promise.reject(new Error('Google authorization unavailable'));
  }
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: calendarScope,
      callback: (result) => {
        if (result?.access_token) resolve(result.access_token);
        else reject(new Error('Google authorization was not completed'));
      },
      error_callback: () => reject(new Error('Google authorization was not completed')),
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}
