/**
 * authSession — the one access-token refresh and the one session wipe, shared
 * by apiClient's response interceptor (services/api.js) and authedFetch
 * (utils/authedFetch.js), so both follow one auth contract (Task #1902).
 *
 * Moved here from services/api.js unchanged, except that the refresh is now
 * single-flight. api.js imports and re-exports both; neither is copied.
 */
import axios from 'axios';

// Uses bare axios so the refresh request bypasses apiClient's interceptor
// (no recursion). Same base URL as apiClient.
const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token in storage');
  const baseURL = import.meta.env.VITE_API_BASE || '';
  const res = await axios.post(`${baseURL}/api/v1/auth/refresh`, { refreshToken });
  const newToken = res.data?.data?.accessToken;
  if (!newToken) throw new Error('No accessToken in refresh response');
  localStorage.setItem('authToken', newToken);
  return newToken;
};

// Single-flight: concurrent callers (the interceptor, authedFetch, several
// streams expiring together) await one refresh call, not N. The refresh
// token does not rotate (POST /auth/refresh returns only an access token),
// so N refreshes would not invalidate each other; one call keeps the
// refreshLimiter budget (10/minute) from being spent and a 429 from reading
// as a failed session.
let inFlight = null;
export function refreshAccessTokenOnce() {
  if (!inFlight) {
    inFlight = refreshAccessToken().finally(() => { inFlight = null; });
  }
  return inFlight;
}

export const wipeSessionAndRedirect = () => {
  // Skip in DEV — keeps hot-reload from kicking devs to /login on every restart.
  if (import.meta.env.DEV) return;
  localStorage.removeItem('authToken');
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
};

// The codes the contract acts on (F-Auth-4 Path 1, fix plan v2.0 §4.6).
// Permission/format failures: surfaced to the caller, never a redirect.
export const PASS_THROUGH_CODES = new Set([
  'AUTH_INVALID_FORMAT',
  'AUTH_GROUP_REQUIRED',
  'AUTH_ROLE_REQUIRED',
]);

// No session present: wipe and redirect.
export const SESSION_FAIL_CODES = new Set([
  'AUTH_REQUIRED',
  'AUTH_MISSING_TOKEN',
]);
