/**
 * Signing in writes no secrets to the console (Task #1976).
 *
 * Runs the real sign-in flow (Login page -> AuthContext.login ->
 * authService.login) with only the HTTP client mocked, spies on every
 * console method, and asserts that no call's arguments contain the tokens,
 * the password, the email or the user object — on success and on a failed
 * sign-in whose axios-shaped error carries the request body.
 */

import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import api from '../services/api';
import { AuthProvider } from './AuthContext';
import Login from '../pages/Login';

const EMAIL = 'lala.secret.email@example.test';
const PASSWORD = 'pw-DO-NOT-LOG-7f3a';
const ACCESS = 'access-token-DO-NOT-LOG-91c2';
const REFRESH = 'refresh-token-DO-NOT-LOG-44e8';
const USER_ID = 'user-id-DO-NOT-LOG-5b10';
const SECRETS = [EMAIL, PASSWORD, ACCESS, REFRESH, USER_ID];

const METHODS = ['log', 'info', 'debug', 'warn', 'error'];

// Everything a console call was given, flattened to one searchable string.
// Objects are walked (not just JSON.stringify'd) so circular axios-style
// errors and non-enumerable Error fields are still inspected.
function flatten(value, seen = new Set()) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object' && typeof value !== 'function') return String(value);
  if (seen.has(value)) return '';
  seen.add(value);
  const keys = new Set([...Object.keys(value), ...Object.getOwnPropertyNames(value)]);
  return [...keys].map((k) => {
    let v;
    try { v = value[k]; } catch { v = ''; }
    return `${k}:${flatten(v, seen)}`;
  }).join('|');
}

function loggedText() {
  return METHODS.flatMap((m) => console[m].mock.calls)
    .map((args) => args.map((a) => flatten(a)).join(' '))
    .join('\n');
}

function signIn() {
  render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: EMAIL } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: PASSWORD } });
  fireEvent.submit(screen.getByLabelText('Email').closest('form'));
}

describe('sign-in logs no secrets (Task #1976)', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    METHODS.forEach((m) => vi.spyOn(console, m).mockImplementation(() => {}));
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  test('a successful sign-in logs no token, email or user details', async () => {
    vi.mocked(api.post).mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: {
          accessToken: ACCESS,
          refreshToken: REFRESH,
          user: { id: USER_ID, email: EMAIL, name: 'Lala' },
        },
      },
    });

    signIn();

    await waitFor(() => expect(localStorage.getItem('authToken')).toBe(ACCESS));
    expect(api.post).toHaveBeenCalledWith('/api/v1/auth/login', expect.objectContaining({ email: EMAIL, password: PASSWORD }));
    const text = loggedText();
    SECRETS.forEach((secret) => expect(text).not.toContain(secret));
  });

  test('a failed sign-in logs no password or email, even though the error carries them', async () => {
    const body = JSON.stringify({ email: EMAIL, password: PASSWORD, groups: ['USER', 'EDITOR'], role: 'USER' });
    const axiosError = Object.assign(new Error('Request failed with status code 401'), {
      isAxiosError: true,
      code: 'ERR_BAD_REQUEST',
      config: { url: '/api/v1/auth/login', method: 'post', data: body },
      request: { _body: body },
      response: {
        status: 401,
        data: { success: false, error: 'Invalid credentials', echo: EMAIL },
        config: { url: '/api/v1/auth/login', method: 'post', data: body },
      },
    });
    vi.mocked(api.post).mockRejectedValue(axiosError);

    signIn();

    await screen.findByText('Invalid email or password. Please try again.');
    // A failure is still logged — with the message and status only.
    expect(console.error).toHaveBeenCalled();
    const text = loggedText();
    expect(text).toContain('Request failed with status code 401');
    SECRETS.forEach((secret) => expect(text).not.toContain(secret));
  });
});
