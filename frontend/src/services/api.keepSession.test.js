/**
 * keepSession (Teleprompter audit 5, 2026-10-24): a request that holds an
 * unsaved take never wipes the session or leaves for /login, and a request
 * with a file is never sent again by itself after a refresh.
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
import apiClient from './api';

const handler = () => apiClient.interceptors.response.handlers.find((h) => h && typeof h.rejected === 'function').rejected;
const err401 = (code, config = {}) => ({ response: { status: 401, data: code ? { code } : {} }, config: { url: '/api/v1/episode-clips/ep', method: 'post', headers: {}, keepSession: true, ...config } });

describe('keepSession requests', () => {
  let originalLocation;
  let warn;
  beforeEach(() => {
    localStorage.clear();
    originalLocation = window.location;
    delete window.location;
    window.location = { href: '' };
    vi.mocked(axios.post).mockReset();
    vi.stubEnv('DEV', '');
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    window.location = originalLocation;
    vi.unstubAllEnvs();
    warn.mockRestore();
  });

  test('AUTH_REQUIRED: no wipe, no redirect; the error says the sign-in expired', async () => {
    localStorage.setItem('authToken', 't');
    const e = err401('AUTH_REQUIRED');
    await expect(handler()(e)).rejects.toBe(e);
    expect(e.sessionExpired).toBe(true);
    expect(localStorage.getItem('authToken')).toBe('t');
    expect(window.location.href).toBe('');
  });

  test('AUTH_INVALID_TOKEN with a refused refresh: no wipe, no redirect, sessionExpired', async () => {
    localStorage.setItem('authToken', 'old');
    localStorage.setItem('refreshToken', 'rt');
    vi.mocked(axios.post).mockRejectedValue({ response: { status: 401 } });
    const e = err401('AUTH_INVALID_TOKEN', { data: new FormData() });
    await expect(handler()(e)).rejects.toBe(e);
    expect(e.sessionExpired).toBe(true);
    expect(localStorage.getItem('refreshToken')).toBe('rt');
    expect(window.location.href).toBe('');
  });

  test('AUTH_INVALID_TOKEN on an upload: refreshed, but the file is not sent again (authRefreshed)', async () => {
    localStorage.setItem('refreshToken', 'rt');
    vi.mocked(axios.post).mockResolvedValue({ data: { data: { accessToken: 'new' } } });
    const adapter = vi.fn();
    const before = apiClient.defaults.adapter;
    apiClient.defaults.adapter = adapter;
    try {
      const e = err401('AUTH_INVALID_TOKEN', { data: new FormData() });
      await expect(handler()(e)).rejects.toBe(e);
      expect(e.authRefreshed).toBe(true);
      expect(localStorage.getItem('authToken')).toBe('new');
      expect(adapter).not.toHaveBeenCalled();
    } finally {
      apiClient.defaults.adapter = before;
    }
  });

  test('AUTH_INVALID_TOKEN on a plain GET (the pre-upload check): refreshed and retried once', async () => {
    localStorage.setItem('refreshToken', 'rt');
    vi.mocked(axios.post).mockResolvedValue({ data: { data: { accessToken: 'new' } } });
    const adapter = vi.fn().mockResolvedValue({ status: 200, data: { ok: 1 }, headers: {}, config: {} });
    const before = apiClient.defaults.adapter;
    apiClient.defaults.adapter = adapter;
    try {
      const e = err401('AUTH_INVALID_TOKEN', { method: 'get' });
      const r = await handler()(e);
      expect(r.data).toEqual({ ok: 1 });
      expect(adapter).toHaveBeenCalledTimes(1);
    } finally {
      apiClient.defaults.adapter = before;
    }
  });

  test('without keepSession the old contract stands (wipe and redirect)', async () => {
    localStorage.setItem('authToken', 't');
    const e = err401('AUTH_REQUIRED', { keepSession: undefined });
    await expect(handler()(e)).rejects.toBe(e);
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(window.location.href).toBe('/login');
  });
});
