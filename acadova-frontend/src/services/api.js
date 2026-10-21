/**
 * Central API Client for Acadova
 * Automatically handles authentication headers, baseUrl, JSON parsing, and 401 intercept.
 */

import { authRecoveryReason } from '../utils/authRecovery';
import { apiUrl } from '../utils/apiUrl';
import { uploadResponse } from './uploadTransport';
import { friendlyApiError, connectionErrorMessage } from '../utils/friendlyApiError';
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
  // Let the browser set the multipart boundary for authenticated document uploads.
  if (options.body instanceof FormData) delete headers['Content-Type'];

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

  const url = apiUrl(API_BASE, endpoint);

  try {
    const response = config.body instanceof FormData && typeof options.onUploadProgress === 'function'
      ? await uploadResponse(url, config, options.onUploadProgress)
      : await fetch(url, config);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const reason = authRecoveryReason(endpoint, response.status, data);
      // A delayed response from an older account must not clear a newer session.
      if (reason && token && token === localStorage.getItem('acadova_token')) {
        onUnauthorizedCallback?.(reason);
      }

      const errorMessage = friendlyApiError(data?.message, response.status, data?.code);
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(config.method) && token
      && token === localStorage.getItem('acadova_token')) {
      window.dispatchEvent(new CustomEvent('acadova:data-changed', { detail: { endpoint } }));
    }
    return data;
  } catch (err) {
    if (!err.status) {
      // Network or DNS error
      err.message = connectionErrorMessage;
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
