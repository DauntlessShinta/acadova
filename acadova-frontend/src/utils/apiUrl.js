// API paths already include /api. Configure the backend origin, without /api.
export function apiUrl(base, endpoint) {
  return `${(base || '').trim().replace(/\/+$/, '')}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}
