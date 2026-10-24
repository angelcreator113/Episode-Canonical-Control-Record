/**
 * authedFetch (Task #1902) — the raw stream requests follow apiClient's auth
 * contract: renew an expired token once and retry once; a failed renewal or
 * a session-less 401 signs out; permission codes pass through.
 *
 * The refresh is the real one (utils/authSession, shared with apiClient's
 * interceptor); only its HTTP call (bare axios.post) is mocked.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal();
  const mockedDefault = function axiosFn(config) { return actual.default(config); };
  Object.assign(mockedDefault, actual.default);
  mockedDefault.post = vi.fn();
  return { default: mockedDefault };
});

import axios from 'axios';
import apiClient from '../services/api';
import { authedFetch } from './authedFetch';
import { openAuthedEventStream } from './authedEventStream';

const refused = (status, code) => ({
  status,
  ok: false,
  body: null,
  clone() { return this; },
  json: async () => (code ? { code } : { error: 'nope' }),
});
const ok = (extra = {}) => ({ status: 200, ok: true, body: null, ...extra });
const refreshOk = (token) => vi.mocked(axios.post).mockResolvedValue({ data: { data: { accessToken: token } } });
const authOf = (fetchImpl, call) => fetchImpl.mock.calls[call][1].headers.Authorization;

describe('authedFetch — apiClient\'s auth contract for raw requests (Task #1902)', () => {
  let originalLocation;
  let errSpy;
  let warnSpy;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('authToken', 'tok-old');
    localStorage.setItem('refreshToken', 'refresh-1');
    originalLocation = window.location;
    delete window.location;
    window.location = { href: '' };
    vi.mocked(axios.post).mockReset();
    // The production path of wipeSessionAndRedirect (it skips in DEV).
    vi.stubEnv('DEV', '');
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    window.location = originalLocation;
    vi.unstubAllEnvs();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  test('attaches the bearer token as a header, never in the URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    await authedFetch('/api/v1/x', { method: 'POST', headers: { 'Content-Type': 'application/json' } }, { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/v1/x');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok-old' });
  });

  test('expired token, refresh succeeds: exactly one retry, with the new token (POST)', async () => {
    refreshOk('tok-new');
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(refused(401, 'AUTH_INVALID_TOKEN'))
      .mockResolvedValueOnce(ok());
    const res = await authedFetch('/api/v1/memories/assistant-command-stream', { method: 'POST', body: '{"a":1}' }, { fetchImpl });
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(authOf(fetchImpl, 0)).toBe('Bearer tok-old');
    expect(authOf(fetchImpl, 1)).toBe('Bearer tok-new');
    expect(fetchImpl.mock.calls[1][1].body).toBe('{"a":1}');
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('authToken')).toBe('tok-new');
    expect(window.location.href).toBe('');
  });

  test('refresh token refused (401): no retry, the session is wiped and the user sent to sign in', async () => {
    vi.mocked(axios.post).mockRejectedValue({ response: { status: 401, data: { code: 'AUTH_REFRESH_FAILED' } } });
    const fetchImpl = vi.fn().mockResolvedValue(refused(401, 'AUTH_INVALID_TOKEN'));
    const res = await authedFetch('/x', { method: 'POST' }, { fetchImpl });
    expect(res.status).toBe(401);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe('/login');
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  // Evoni, 2026-10-23: signed out right after a deploy. The refresh landing
  // on the restart (502, then no response) is waited out, not a sign-out.
  test('refresh hits the restart (502, then a network error): waited out, then one retry; still signed in', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(axios.post)
        .mockRejectedValueOnce({ response: { status: 502, data: '<html>Bad Gateway</html>' } })
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce({ data: { data: { accessToken: 'tok-new' } } });
      const fetchImpl = vi.fn()
        .mockResolvedValueOnce(refused(401, 'AUTH_INVALID_TOKEN'))
        .mockResolvedValueOnce(ok());
      const pending = authedFetch('/x', {}, { fetchImpl });
      await vi.runAllTimersAsync();
      const res = await pending;
      expect(res.status).toBe(200);
      expect(axios.post).toHaveBeenCalledTimes(3);
      expect(authOf(fetchImpl, 1)).toBe('Bearer tok-new');
      expect(window.location.href).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  test('refresh still unreachable after the waits: a 503 to the caller, and the session is kept', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(axios.post).mockRejectedValue({ response: { status: 503, data: { code: 'AUTH_SERVICE_UNAVAILABLE' } } });
      const fetchImpl = vi.fn().mockResolvedValue(refused(401, 'AUTH_INVALID_TOKEN'));
      const pending = authedFetch('/x', {}, { fetchImpl });
      await vi.runAllTimersAsync();
      const res = await pending;
      expect(res.status).toBe(503);
      expect((await res.json()).code).toBe('AUTH_REFRESH_UNAVAILABLE');
      expect(axios.post).toHaveBeenCalledTimes(5); // the first try and four waits
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(window.location.href).toBe('');
      expect(localStorage.getItem('authToken')).toBe('tok-old');
      expect(localStorage.getItem('refreshToken')).toBe('refresh-1');
    } finally {
      vi.useRealTimers();
    }
  });

  test('refresh refused by a rate limit (429): not retried, not a sign-out', async () => {
    vi.mocked(axios.post).mockRejectedValue({ response: { status: 429, data: { code: 'AUTH_TOO_MANY_REFRESHES' } } });
    const fetchImpl = vi.fn().mockResolvedValue(refused(401, 'AUTH_INVALID_TOKEN'));
    const res = await authedFetch('/x', {}, { fetchImpl });
    expect(res.status).toBe(503);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe('');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-1');
  });

  test('the retry refused again: never a second retry, and a sign-out', async () => {
    refreshOk('tok-new');
    const fetchImpl = vi.fn().mockResolvedValue(refused(401, 'AUTH_INVALID_TOKEN'));
    await authedFetch('/x', {}, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe('/login');
  });

  test.each(['AUTH_GROUP_REQUIRED', 'AUTH_ROLE_REQUIRED'])('403 %s: no refresh, no redirect, returned to the caller', async (code) => {
    const fetchImpl = vi.fn().mockResolvedValue(refused(403, code));
    const res = await authedFetch('/x', {}, { fetchImpl });
    expect(res.status).toBe(403);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(axios.post).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  test('401 AUTH_INVALID_FORMAT passes through too', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(refused(401, 'AUTH_INVALID_FORMAT'));
    await authedFetch('/x', {}, { fetchImpl });
    expect(axios.post).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  test.each([['AUTH_REQUIRED'], ['AUTH_MISSING_TOKEN'], [null], ['SOMETHING_NEW']])('401 %s: no refresh, no retry, a redirect', async (code) => {
    const fetchImpl = vi.fn().mockResolvedValue(refused(401, code));
    await authedFetch('/x', {}, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(axios.post).not.toHaveBeenCalled();
    expect(window.location.href).toBe('/login');
  });

  test('only AUTH_INVALID_TOKEN retries: a 500 or a 403 is returned as it is', async () => {
    for (const r of [{ status: 500, ok: false, body: null }, refused(403, null)]) {
      const fetchImpl = vi.fn().mockResolvedValue(r);
      await authedFetch('/x', {}, { fetchImpl });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
    expect(axios.post).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  test('in DEV the sign-out is skipped and the 401 reaches the caller (its "session expired" message)', async () => {
    vi.stubEnv('DEV', 'true');
    const fetchImpl = vi.fn().mockResolvedValue(refused(401, 'AUTH_REQUIRED'));
    const res = await authedFetch('/x', {}, { fetchImpl });
    expect(res.status).toBe(401);
    expect(window.location.href).toBe('');
    expect(localStorage.getItem('authToken')).toBe('tok-old');
  });

  test('two expired requests at once, one from apiClient\'s interceptor and one from authedFetch: one refresh', async () => {
    let release;
    vi.mocked(axios.post).mockImplementation(() => new Promise((r) => { release = () => r({ data: { data: { accessToken: 'tok-new' } } }); }));

    const handlers = apiClient.interceptors.response.handlers;
    const rejected = handlers.find((h) => h && typeof h.rejected === 'function').rejected;
    const retriedConfigs = [];
    const originalAdapter = apiClient.defaults.adapter;
    apiClient.defaults.adapter = async (config) => {
      retriedConfigs.push(config);
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    };

    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(refused(401, 'AUTH_INVALID_TOKEN'))
      .mockResolvedValueOnce(ok());
    try {
      const viaInterceptor = rejected({
        response: { status: 401, data: { code: 'AUTH_INVALID_TOKEN' } },
        config: { url: '/api/v1/episodes', method: 'get', headers: {} },
      });
      const viaFetch = authedFetch('/api/v1/stream', {}, { fetchImpl });
      await new Promise((r) => setTimeout(r, 0));
      release();
      await Promise.all([viaInterceptor, viaFetch]);
    } finally {
      apiClient.defaults.adapter = originalAdapter;
    }

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(retriedConfigs).toHaveLength(1);
    expect(authOf(fetchImpl, 1)).toBe('Bearer tok-new');
  });
});

describe('openAuthedEventStream renews an expired token (Task #1902)', () => {
  let errSpy;
  let warnSpy;
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('authToken', 'tok-old');
    localStorage.setItem('refreshToken', 'refresh-1');
    vi.mocked(axios.post).mockReset();
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { errSpy.mockRestore(); warnSpy.mockRestore(); });

  test('GET stream: one reconnect with the new token, the events arrive, no network retry spent', async () => {
    refreshOk('tok-new');
    const enc = new TextEncoder();
    const chunks = ['event: status\ndata: {"done":3}\n\n'];
    const reader = { read: vi.fn(async () => (chunks.length ? { done: false, value: enc.encode(chunks.shift()) } : new Promise(() => {}))), cancel: vi.fn(async () => {}) };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(refused(401, 'AUTH_INVALID_TOKEN'))
      .mockResolvedValueOnce({ status: 200, ok: true, body: { getReader: () => reader } });
    const status = vi.fn();
    const onError = vi.fn();
    const onAuthError = vi.fn();
    const h = openAuthedEventStream('/api/v1/jobs/1/stream', { handlers: { status }, onError, onAuthError, fetchImpl });
    await vi.waitFor(() => expect(status).toHaveBeenCalledTimes(1));
    expect(JSON.parse(status.mock.calls[0][0].data)).toEqual({ done: 3 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(authOf(fetchImpl, 1)).toBe('Bearer tok-new');
    expect(onError).not.toHaveBeenCalled();
    expect(onAuthError).not.toHaveBeenCalled();
    h.close();
  });
});
