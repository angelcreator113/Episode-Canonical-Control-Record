/**
 * Tests for apiClient response interceptor — F-Auth-4 Path 1 contract.
 * Tracks 1.5 deliverable per fix plan v2.1 §4.6.
 *
 * Mocks axios at module scope so refreshAccessToken's bare axios.post is
 * controllable per test. axios.create is preserved so apiClient still
 * constructs normally and its registered interceptor is the real one.
 */

import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal();
  const mockedDefault = function axiosFn(config) {
    return actual.default(config);
  };
  Object.assign(mockedDefault, actual.default);
  mockedDefault.post = vi.fn();
  return { default: mockedDefault };
});

import axios from 'axios';
import apiClient from './api';

const getRejectedHandler = () => {
  const handlers = apiClient.interceptors.response.handlers;
  // Find the first non-cleared handler (axios sets cleared entries to null on eject).
  const entry = handlers.find((h) => h && typeof h.rejected === 'function');
  if (!entry) throw new Error('Response interceptor rejected handler not found');
  return entry.rejected;
};

const makeAxiosError = (status, code, configOverrides = {}) => ({
  response: {
    status,
    data: code !== undefined ? { code } : {},
  },
  config: { url: '/some/endpoint', method: 'get', headers: {}, ...configOverrides },
});

describe('apiClient response interceptor — F-Auth-4 Path 1', () => {
  let handler;
  let originalLocation;

  beforeEach(() => {
    handler = getRejectedHandler();
    localStorage.clear();
    originalLocation = window.location;
    delete window.location;
    window.location = { href: '' };
    vi.mocked(axios.post).mockReset();
    // Force the production path of wipeSessionAndRedirect — the helper early-
    // returns when import.meta.env.DEV is truthy. Vitest defaults DEV=true.
    vi.stubEnv('DEV', '');
  });

  afterEach(() => {
    window.location = originalLocation;
    vi.unstubAllEnvs();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case A — AUTH_REQUIRED variants trigger wipeSessionAndRedirect
  // ──────────────────────────────────────────────────────────────────────────
  describe('Case A — AUTH_REQUIRED / AUTH_MISSING_TOKEN / no-code 401', () => {
    test('AUTH_REQUIRED → wipe creds, redirect to /login, no refresh attempted', async () => {
      localStorage.setItem('authToken', 'stale');
      localStorage.setItem('refreshToken', 'rt-1');

      const err = makeAxiosError(401, 'AUTH_REQUIRED');
      await expect(handler(err)).rejects.toBe(err);

      expect(localStorage.getItem('authToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
      expect(window.location.href).toBe('/login');
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('AUTH_MISSING_TOKEN → wipe + redirect', async () => {
      localStorage.setItem('authToken', 'stale');

      const err = makeAxiosError(401, 'AUTH_MISSING_TOKEN');
      await expect(handler(err)).rejects.toBe(err);

      expect(localStorage.getItem('authToken')).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    test('401 with no code → wipe + redirect (defensive default)', async () => {
      localStorage.setItem('authToken', 'stale');

      const err = { response: { status: 401, data: {} }, config: { url: '/foo', headers: {} } };
      await expect(handler(err)).rejects.toBe(err);

      expect(localStorage.getItem('authToken')).toBeNull();
      expect(window.location.href).toBe('/login');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case B — AUTH_INVALID_TOKEN first hit triggers refresh + retry
  // ──────────────────────────────────────────────────────────────────────────
  describe('Case B — AUTH_INVALID_TOKEN first attempt: refresh + retry', () => {
    test('refresh succeeds → original request retries with new token + _retried flag', async () => {
      localStorage.setItem('authToken', 'old');
      localStorage.setItem('refreshToken', 'rt-1');

      vi.mocked(axios.post).mockResolvedValue({
        data: { data: { accessToken: 'new-token' } },
      });

      const originalAdapter = apiClient.defaults.adapter;
      const adapterMock = vi.fn().mockResolvedValue({
        status: 200,
        data: { ok: true },
        headers: {},
        config: { url: '/some/endpoint' },
      });
      apiClient.defaults.adapter = adapterMock;

      try {
        const originalConfig = { url: '/some/endpoint', method: 'get', headers: {} };
        const err = makeAxiosError(401, 'AUTH_INVALID_TOKEN');
        err.config = originalConfig;

        const result = await handler(err);

        expect(axios.post).toHaveBeenCalledTimes(1);
        const [refreshUrl, refreshBody] = vi.mocked(axios.post).mock.calls[0];
        expect(refreshUrl).toContain('/api/v1/auth/refresh');
        expect(refreshBody).toEqual({ refreshToken: 'rt-1' });

        expect(localStorage.getItem('authToken')).toBe('new-token');

        expect(adapterMock).toHaveBeenCalledTimes(1);
        expect(originalConfig._retried).toBe(true);

        expect(result.status).toBe(200);
        expect(result.data).toEqual({ ok: true });

        expect(window.location.href).toBe('');
      } finally {
        apiClient.defaults.adapter = originalAdapter;
      }
    });

    test('refresh throws (no refresh token in storage) → wipe + redirect, no second attempt', async () => {
      localStorage.setItem('authToken', 'old');
      // no refreshToken set — refreshAccessToken will throw

      const originalConfig = { url: '/some/endpoint', method: 'get', headers: {} };
      const err = makeAxiosError(401, 'AUTH_INVALID_TOKEN');
      err.config = originalConfig;

      await expect(handler(err)).rejects.toBe(err);

      expect(axios.post).not.toHaveBeenCalled(); // refresh threw before posting
      expect(localStorage.getItem('authToken')).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    test('refresh token refused (401 AUTH_REFRESH_FAILED) → wipe + redirect', async () => {
      localStorage.setItem('authToken', 'old');
      localStorage.setItem('refreshToken', 'rt-1');

      vi.mocked(axios.post).mockRejectedValue({ response: { status: 401, data: { code: 'AUTH_REFRESH_FAILED' } } });

      const err = makeAxiosError(401, 'AUTH_INVALID_TOKEN');
      err.config = { url: '/some/endpoint', method: 'get', headers: {} };

      await expect(handler(err)).rejects.toBe(err);

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('authToken')).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    // Evoni, 2026-10-23: signed out right after a deploy. A refresh that
    // lands on the restart is waited out; it never signs her out.
    test('refresh unreachable through the restart (network down every time) → no wipe, the request fails as a server problem', async () => {
      vi.useFakeTimers();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        localStorage.setItem('authToken', 'old');
        localStorage.setItem('refreshToken', 'rt-1');
        const networkDown = Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });
        vi.mocked(axios.post).mockRejectedValue(networkDown);

        const err = makeAxiosError(401, 'AUTH_INVALID_TOKEN');
        err.config = { url: '/some/endpoint', method: 'get', headers: {} };

        const pending = handler(err);
        const settled = expect(pending).rejects.toBe(networkDown);
        await vi.runAllTimersAsync();
        await settled;

        expect(axios.post).toHaveBeenCalledTimes(5);
        expect(localStorage.getItem('authToken')).toBe('old');
        expect(localStorage.getItem('refreshToken')).toBe('rt-1');
        expect(window.location.href).toBe('');
      } finally {
        warn.mockRestore();
        vi.useRealTimers();
      }
    });

    test('refresh gets a 503 then succeeds → the original request retries; still signed in', async () => {
      vi.useFakeTimers();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const originalAdapter = apiClient.defaults.adapter;
      apiClient.defaults.adapter = vi.fn().mockResolvedValue({ status: 200, data: { ok: true }, headers: {}, config: {} });
      try {
        localStorage.setItem('authToken', 'old');
        localStorage.setItem('refreshToken', 'rt-1');
        vi.mocked(axios.post)
          .mockRejectedValueOnce({ response: { status: 503, data: { code: 'AUTH_SERVICE_UNAVAILABLE' } } })
          .mockResolvedValueOnce({ data: { data: { accessToken: 'new-token' } } });

        const err = makeAxiosError(401, 'AUTH_INVALID_TOKEN');
        err.config = { url: '/some/endpoint', method: 'get', headers: {} };

        const pending = handler(err);
        await vi.runAllTimersAsync();
        const result = await pending;

        expect(result.status).toBe(200);
        expect(axios.post).toHaveBeenCalledTimes(2);
        expect(localStorage.getItem('authToken')).toBe('new-token');
        expect(window.location.href).toBe('');
      } finally {
        apiClient.defaults.adapter = originalAdapter;
        warn.mockRestore();
        vi.useRealTimers();
      }
    });

    test('refresh refused by its rate limit (429) → not retried, no wipe', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        localStorage.setItem('authToken', 'old');
        localStorage.setItem('refreshToken', 'rt-1');
        const limited = { response: { status: 429, data: { code: 'AUTH_TOO_MANY_REFRESHES' } } };
        vi.mocked(axios.post).mockRejectedValue(limited);

        const err = makeAxiosError(401, 'AUTH_INVALID_TOKEN');
        err.config = { url: '/some/endpoint', method: 'get', headers: {} };

        await expect(handler(err)).rejects.toBe(limited);
        expect(axios.post).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('authToken')).toBe('old');
        expect(window.location.href).toBe('');
      } finally {
        warn.mockRestore();
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case C — AUTH_INVALID_TOKEN on retry does NOT loop
  // ──────────────────────────────────────────────────────────────────────────
  describe('Case C — single-retry-then-redirect contract (no infinite loop)', () => {
    test('originalConfig._retried=true → wipe + redirect, no second refresh', async () => {
      localStorage.setItem('authToken', 'still-something');
      localStorage.setItem('refreshToken', 'rt-1');

      const originalConfig = {
        url: '/some/endpoint',
        method: 'get',
        headers: {},
        _retried: true,
      };
      const err = makeAxiosError(401, 'AUTH_INVALID_TOKEN');
      err.config = originalConfig;

      await expect(handler(err)).rejects.toBe(err);

      expect(axios.post).not.toHaveBeenCalled();
      expect(localStorage.getItem('authToken')).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    test('failure on /api/v1/auth/refresh URL → wipe + redirect, no recursive refresh', async () => {
      localStorage.setItem('authToken', 'still');
      localStorage.setItem('refreshToken', 'rt-1');

      const originalConfig = {
        url: '/api/v1/auth/refresh',
        method: 'post',
        headers: {},
      };
      const err = makeAxiosError(401, 'AUTH_INVALID_TOKEN');
      err.config = originalConfig;

      await expect(handler(err)).rejects.toBe(err);

      expect(axios.post).not.toHaveBeenCalled();
      expect(localStorage.getItem('authToken')).toBeNull();
      expect(window.location.href).toBe('/login');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case D — pass-through codes (LOCKED §4.6) do NOT trigger redirect
  // ──────────────────────────────────────────────────────────────────────────
  describe('Case D — pass-through codes (LOCKED, never redirect)', () => {
    test.each([
      ['AUTH_INVALID_FORMAT', 401],
      ['AUTH_GROUP_REQUIRED', 403],
      ['AUTH_ROLE_REQUIRED', 403],
    ])('%s (status %i) → caller receives rejection, creds intact', async (code, status) => {
      localStorage.setItem('authToken', 'valid-session');
      localStorage.setItem('refreshToken', 'rt-1');

      const err = makeAxiosError(status, code);
      await expect(handler(err)).rejects.toBe(err);

      expect(localStorage.getItem('authToken')).toBe('valid-session');
      expect(localStorage.getItem('refreshToken')).toBe('rt-1');
      expect(window.location.href).toBe('');
      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case E — non-auth errors pass through unchanged
  // ──────────────────────────────────────────────────────────────────────────
  describe('Case E — non-auth errors pass through', () => {
    test('500 server error → caller receives rejection, no redirect, creds intact', async () => {
      localStorage.setItem('authToken', 'valid-session');

      const err = makeAxiosError(500, 'SERVER_ERROR');
      await expect(handler(err)).rejects.toBe(err);

      expect(localStorage.getItem('authToken')).toBe('valid-session');
      expect(window.location.href).toBe('');
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('Network error (no response) → passes through', async () => {
      localStorage.setItem('authToken', 'valid-session');

      const err = { request: {}, message: 'Network Error', config: { url: '/foo' } };
      await expect(handler(err)).rejects.toBe(err);

      expect(localStorage.getItem('authToken')).toBe('valid-session');
      expect(window.location.href).toBe('');
    });

    test('400 with non-auth code → passes through', async () => {
      localStorage.setItem('authToken', 'valid-session');

      const err = makeAxiosError(400, 'VALIDATION_ERROR');
      await expect(handler(err)).rejects.toBe(err);

      expect(localStorage.getItem('authToken')).toBe('valid-session');
      expect(window.location.href).toBe('');
    });
  });
});
