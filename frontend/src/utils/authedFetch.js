/**
 * authedFetch — `fetch` with apiClient's auth contract, for the requests that
 * cannot go through apiClient (streams read with `res.body.getReader()`).
 *
 * Task #1902, Evoni's ruling (a): one auth contract everywhere. apiClient's
 * response interceptor (services/api.js) renews an expired access token once
 * and retries; these raw requests used to show "session expired" instead.
 *
 *  - Attaches `Authorization: Bearer <token>` (utils/authToken readAuthToken).
 *    The token is only ever a header, never in the URL.
 *  - 401 with code AUTH_INVALID_TOKEN: refresh once (utils/authSession
 *    refreshAccessTokenOnce, the same single-flight refresh the interceptor
 *    uses), then retry the request once with the new token. Retrying a POST
 *    is safe only because requireAuth rejects the request before any handler
 *    runs: no Claude call has started, nothing was billed or written. A
 *    request is never retried more than once.
 *  - The refresh fails, the retry is refused again, or a 401 with
 *    AUTH_REQUIRED, AUTH_MISSING_TOKEN, no code or an unknown code: the
 *    session is over. wipeSessionAndRedirect (the interceptor's own; it does
 *    nothing in DEV) sends the user to sign in.
 *  - AUTH_INVALID_FORMAT, AUTH_GROUP_REQUIRED, AUTH_ROLE_REQUIRED, and any
 *    other status: returned to the caller untouched, no refresh, no redirect.
 *
 * Returns the final Response. A caller still checking for 401/403 sees one
 * only for the pass-through codes, or in DEV, where the wipe is skipped.
 */
import { readAuthToken } from './authToken';
import {
  refreshAccessTokenOnce, wipeSessionAndRedirect, PASS_THROUGH_CODES,
} from './authSession';

const withToken = (init, token) => ({
  ...init,
  headers: {
    ...(init.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
});

/** The JSON `code` of a refused response, read from a clone; null if none. */
async function authCode(res) {
  try {
    const body = await (typeof res.clone === 'function' ? res.clone() : res).json();
    return body?.code || null;
  } catch (err) {
    // No JSON body: a refusal with no code (handled as one below).
    console.warn('authedFetch: refusal has no JSON code', err?.message);
    return null;
  }
}

export async function authedFetch(url, init = {}, { fetchImpl } = {}) {
  const doFetch = fetchImpl || fetch;
  const res = await doFetch(url, withToken(init, readAuthToken()));
  if (res.status !== 401 && res.status !== 403) return res;

  const code = await authCode(res);
  if (code && PASS_THROUGH_CODES.has(code)) return res;
  if (res.status !== 401) return res;

  if (code === 'AUTH_INVALID_TOKEN') {
    let token;
    try {
      token = await refreshAccessTokenOnce();
    } catch (refreshErr) {
      console.error('authedFetch: token refresh failed; signing out', refreshErr);
      wipeSessionAndRedirect();
      return res;
    }
    // The one retry. requireAuth refused the first request before any
    // handler ran, so repeating a POST starts its work only once.
    const retried = await doFetch(url, withToken(init, token));
    if (retried.status === 401) {
      const again = await authCode(retried);
      if (!again || !PASS_THROUGH_CODES.has(again)) wipeSessionAndRedirect();
    }
    return retried;
  }

  // AUTH_REQUIRED, AUTH_MISSING_TOKEN (SESSION_FAIL_CODES), no code or an
  // unknown code: the session is over (ruling (a)).
  wipeSessionAndRedirect();
  return res;
}
