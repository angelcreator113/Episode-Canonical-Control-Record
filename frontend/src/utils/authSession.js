/**
 * authSession — the one access-token refresh and the one session wipe, shared
 * by apiClient's response interceptor (services/api.js) and authedFetch
 * (utils/authedFetch.js), so both follow one auth contract (Task #1902).
 *
 * Moved here from services/api.js unchanged, except that the refresh is now
 * single-flight. api.js imports and re-exports both; neither is copied.
 */
import axios from 'axios';

// Only a real answer that the refresh token is no good ends the session: a
// 401 from POST /auth/refresh (AUTH_REFRESH_FAILED), a 400 (no or malformed
// refresh token), or no refresh token stored. Anything else (the server
// restarting during a deploy, a 502/503/504 from the load balancer, a
// network error, a 429, a 500) says nothing about the session, so it is
// retried a few times and then reported as a server problem, and the user
// stays signed in. Evoni, 2026-10-23: signed out right after a deploy.
export class RefreshFailed extends Error {
  constructor(message, { sessionOver, status = null, cause } = {}) {
    super(message);
    this.name = 'RefreshFailed';
    this.sessionOver = !!sessionOver;
    this.status = status;
    if (cause) this.cause = cause;
  }
}

// Statuses worth waiting out: the API is restarting or briefly unreachable.
const RETRY_STATUSES = new Set([502, 503, 504]);
// About 15 s in all, long enough for a pm2 restart to come back up.
export const REFRESH_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Uses bare axios so the refresh request bypasses apiClient's interceptor
// (no recursion). Same base URL as apiClient.
const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new RefreshFailed('No refresh token in storage', { sessionOver: true });
  const baseURL = import.meta.env.VITE_API_BASE || '';
  for (let attempt = 0; ; attempt += 1) {
    let res;
    try {
      res = await axios.post(`${baseURL}/api/v1/auth/refresh`, { refreshToken });
    } catch (err) {
      const status = err?.response?.status ?? null;
      if (status === 401 || status === 400) {
        throw new RefreshFailed('The refresh token was refused', { sessionOver: true, status, cause: err });
      }
      // No response at all is a network error (the server is down or the
      // connection dropped mid-restart): worth waiting out like a 502.
      const transient = status === null || RETRY_STATUSES.has(status);
      if (transient && attempt < REFRESH_RETRY_DELAYS_MS.length) {
        console.warn(`authSession: refresh got ${status || 'no response'}; retrying`);
        await wait(REFRESH_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new RefreshFailed('The session could not be refreshed right now', { sessionOver: false, status, cause: err });
    }
    const newToken = res.data?.data?.accessToken;
    if (!newToken) throw new RefreshFailed('No accessToken in refresh response', { sessionOver: true, status: res.status });
    localStorage.setItem('authToken', newToken);
    return newToken;
  }
};

/** True when a refresh failure means the session is over (sign out). */
export const refreshEndsSession = (err) => !!(err && err.sessionOver);

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
