/**
 * Central API Client for Acadova
 * Automatically handles authentication headers, baseUrl, JSON parsing, and 401 intercept.
 */

import { authRecoveryReason } from '../utils/authRecovery';
const API_BASE = import.meta.env.VITE_API_URL || '';

let onUnauthorizedCallback = null;

export const setOnUnauthorized = (callback) => {
  onUnauthorizedCallback = callback;
};

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('acadova_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const reason = authRecoveryReason(endpoint, response.status, data);
      // A delayed response from an older account must not clear a newer session.
      if (reason && token && token === localStorage.getItem('acadova_token')) {
        onUnauthorizedCallback?.(reason);
      }

      const errorMessage = data?.message || `Request failed with status ${response.status}`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (!err.status) {
      // Network or DNS error
      err.message = err.message || 'Unable to connect to Acadova server';
    }
    throw err;
  }
}

export const api = {
  get: (url, options = {}) => request(url, { ...options, method: 'GET' }),
  post: (url, body, options = {}) => request(url, { ...options, method: 'POST', body }),
  patch: (url, body, options = {}) => request(url, { ...options, method: 'PATCH', body }),
  put: (url, body, options = {}) => request(url, { ...options, method: 'PUT', body }),
  delete: (url, options = {}) => request(url, { ...options, method: 'DELETE' }),
};

export default api;
