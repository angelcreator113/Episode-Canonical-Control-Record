/**
 * A rate limit's wait on the login page (Evoni, 2026-10-23: locked out twice
 * with no idea for how long). A 429 with retry_after_seconds shows a live
 * "Try again in m:ss" and keeps Sign in off until it runs out; then the
 * button comes back and the message clears.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const login = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ login, isAuthenticated: false }),
}));
vi.mock('../services/authService', () => ({ default: {} }));

import Login from './Login';
import { formatWait, secondsUntil } from '../hooks/useCountdown';

const refusal = (data) => Object.assign(new Error('Request failed with status code 429'), {
  response: { status: 429, data },
});

const renderLogin = () => render(<MemoryRouter><Login /></MemoryRouter>);
const submit = async () => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'e@x.dev' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-pw' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'ENTER THE STUDIO' })); });
};
const button = () => screen.getByRole('button', { name: 'ENTER THE STUDIO' });

describe('login countdown', () => {
  let errSpy;
  beforeEach(() => {
    vi.useFakeTimers();
    login.mockReset();
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    errSpy.mockRestore();
  });

  test('counts down, keeps Sign in off, then re-enables and clears the message', async () => {
    login.mockRejectedValue(refusal({
      code: 'AUTH_TOO_MANY_FAILED_SIGNINS',
      limit: 'sign-in',
      message: 'Too many wrong passwords from this device. Try again in about 5 minutes.',
      retry_after_minutes: 5,
      retry_after_seconds: 272,
    }));
    renderLogin();
    await submit();

    expect(screen.getByText(/Too many wrong passwords from this device/)).toBeTruthy();
    expect(screen.getByTestId('login-countdown').textContent).toBe('Try again in 4:32');
    expect(button().disabled).toBe(true);

    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.getByTestId('login-countdown').textContent).toBe('Try again in 4:31');

    // Submitting during the wait sends nothing.
    await act(async () => { fireEvent.submit(button().closest('form')); });
    expect(login).toHaveBeenCalledTimes(1);

    await act(async () => { vi.advanceTimersByTime(271 * 1000); });
    expect(screen.queryByTestId('login-countdown')).toBeNull();
    expect(screen.queryByText(/Too many wrong passwords/)).toBeNull();
    expect(button().disabled).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('falls back to the minutes field when seconds are missing', async () => {
    login.mockRejectedValue(refusal({ message: 'Wait.', retry_after_minutes: 2 }));
    renderLogin();
    await submit();
    expect(screen.getByTestId('login-countdown').textContent).toBe('Try again in 2:00');
  });

  test('a 429 with no wait (Cognito busy) shows the message with no countdown and leaves Sign in on', async () => {
    login.mockRejectedValue(refusal({ code: 'AUTH_TOO_MANY_REQUESTS', limit: 'cognito', message: 'The sign-in service is busy right now. Wait a minute and try again.' }));
    renderLogin();
    await submit();
    expect(screen.getByText(/sign-in service is busy/)).toBeTruthy();
    expect(screen.queryByTestId('login-countdown')).toBeNull();
    expect(button().disabled).toBe(false);
  });

  test('the timer is cleared on unmount', async () => {
    login.mockRejectedValue(refusal({ message: 'Wait.', retry_after_seconds: 30 }));
    const { unmount } = renderLogin();
    await submit();
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('formatWait and secondsUntil', () => {
    expect(formatWait(272)).toBe('4:32');
    expect(formatWait(9)).toBe('0:09');
    expect(formatWait(3725)).toBe('1:02:05');
    expect(secondsUntil(null)).toBe(0);
    expect(secondsUntil(10_500, 10_000)).toBe(1);
    expect(secondsUntil(5_000, 10_000)).toBe(0);
  });
});
