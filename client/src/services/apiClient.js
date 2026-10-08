/**
 * ServiceDesk Pro — Centralized API Client
 *
 * Handles HTTP requests, authentication headers, JSON parsing, error normalization,
 * and 401 unauthorized interception.
 *
 * Security Note:
 * Tokens are stored in localStorage for SPA persistence across sessions and tabs.
 * While suitable for this environment, localStorage is accessible to client JavaScript and
 * therefore vulnerable to XSS. In strict production enterprise environments, consider HttpOnly
 * SameSite Secure cookies or short-lived memory tokens with refresh-token rotation.
 */

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  '/api';
const TOKEN_KEY = 'servicedesk_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/**
 * Custom API Error class with HTTP status code and server response data.
 */
export class ApiError extends Error {
  constructor(message, status = 500, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Core fetch wrapper with base URL, auth token injection, and response parsing.
 *
 * @param {string} endpoint - API path relative to API_BASE_URL (e.g. '/auth/login')
 * @param {RequestInit} [options={}] - Standard fetch options
 * @returns {Promise<any>}
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  // Attach Bearer token if present and not already provided
  const token = getToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  // If body is FormData, delete Content-Type to let browser set boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const config = {
    ...options,
    headers,
  };

  let response;
  try {
    response = await fetch(url, config);
  } catch (networkErr) {
    throw new ApiError(
      'Network error. Please verify the backend server is running and reachable.',
      0,
      networkErr
    );
  }

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  // Handle Unauthorized (401)
  if (response.status === 401) {
    clearToken();
    // Dispatch unauthorized event so AuthContext can clean state without circular dependency
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { endpoint } }));
    }
    const message = (data && data.message) || 'Session expired or unauthorized. Please log in again.';
    throw new ApiError(message, 401, data);
  }

  // Handle Other HTTP Errors
  if (!response.ok) {
    const message = (data && data.message) || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data;
}

export const api = {
  get: (endpoint, options) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options) =>
    request(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: (endpoint, body, options) =>
    request(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  put: (endpoint, body, options) =>
    request(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  delete: (endpoint, options) => request(endpoint, { ...options, method: 'DELETE' }),
};

export default api;
