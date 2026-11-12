/**
 * authService.logout sends the refresh token so the backend can end the
 * session at Cognito (Task #3797; ruled 2026-11-11, option (b)), and always
 * clears this browser's copies.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('./api', () => ({ default: { post: vi.fn() } }));

import api from './api';
import { authService } from './authService';

const REFRESH = 'a-cognito-refresh-token-that-is-long-enough-to-look-like-one';

describe('authService.logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  const signIn = () => {
    localStorage.setItem('authToken', 'access-token');
    localStorage.setItem('refreshToken', REFRESH);
    localStorage.setItem('user', JSON.stringify({ id: 'u1' }));
  };

  test('sends the stored refresh token in the /logout body, then clears storage', async () => {
    signIn();
    api.post.mockResolvedValue({ data: { success: true } });

    await authService.logout();

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/api/v1/auth/logout', { refreshToken: REFRESH });
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  test('reads the refresh token before it is cleared, even when the request is slow', async () => {
    signIn();
    let sentBody;
    api.post.mockImplementation((_url, body) => {
      sentBody = body;
      return new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 5));
    });

    await authService.logout();

    expect(sentBody).toEqual({ refreshToken: REFRESH });
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  test('clears storage even when the backend call fails, and does not throw', async () => {
    signIn();
    api.post.mockRejectedValue(new Error('Network Error'));

    await expect(authService.logout()).resolves.toBeUndefined();

    expect(api.post).toHaveBeenCalledWith('/api/v1/auth/logout', { refreshToken: REFRESH });
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  test('never logs the refresh token when the backend call fails', async () => {
    signIn();
    api.post.mockRejectedValue(new Error('Request failed with status code 500'));

    await authService.logout();

    const logged = console.warn.mock.calls.map((args) => args.map(String).join(' ')).join('\n');
    expect(logged).not.toContain(REFRESH);
  });

  test('with no refresh token stored, it sends an empty body and still clears', async () => {
    localStorage.setItem('authToken', 'access-token');
    api.post.mockResolvedValue({ data: {} });

    await authService.logout();

    expect(api.post).toHaveBeenCalledWith('/api/v1/auth/logout', {});
    expect(localStorage.getItem('authToken')).toBeNull();
  });

  test('when not signed in, it makes no request and leaves storage clear', async () => {
    await authService.logout();

    expect(api.post).not.toHaveBeenCalled();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});
