/**
 * authToken — the one place the frontend's raw-fetch sites read the bearer
 * token from.
 *
 * Tasks #1887 and #1894. Sites that cannot go through apiClient (SSE streams
 * read with `res.body.getReader()`) attach `Authorization: Bearer <token>`
 * themselves. They read the token from the same localStorage keys the
 * apiClient request interceptor uses. The token is only ever sent as a
 * header, never in a URL.
 */
export function readAuthToken() {
  try {
    return localStorage.getItem('authToken') || localStorage.getItem('token');
  } catch (err) {
    console.error('authToken: could not read the auth token', err);
    return null;
  }
}
