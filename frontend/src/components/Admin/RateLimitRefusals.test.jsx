/**
 * Admin › Tools: Recent refusals — newest first, a count per limit, and a
 * note that the list clears when the server restarts.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
import apiClient from '../../services/api';
import RateLimitRefusals, { limitLabel } from './RateLimitRefusals';

const payload = {
  kept: 200,
  counts: { site: 1, 'sign-in': 2 },
  refusals: [
    { at: '2026-10-23T18:05:00.000Z', limit: 'sign-in', code: 'AUTH_TOO_MANY_FAILED_SIGNINS', method: 'POST', path: '/api/v1/auth/login', ip: '198.51.100.x' },
    { at: '2026-10-23T18:04:00.000Z', limit: 'site', code: 'API_TOO_MANY_REQUESTS', method: 'GET', path: '/api/v1/episodes', ip: '198.51.100.x' },
    { at: '2026-10-23T18:03:00.000Z', limit: 'sign-in', code: 'AUTH_TOO_MANY_FAILED_SIGNINS', method: 'POST', path: '/api/v1/auth/login', ip: '198.51.100.x' },
  ],
};

describe('RateLimitRefusals', () => {
  beforeEach(() => { vi.mocked(apiClient.get).mockReset(); });

  test('lists refusals in the order the server gives (newest first) with counts per limit, highest first', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: payload } });
    render(<RateLimitRefusals />);

    await screen.findByRole('list', { name: 'Refusals per limit' });
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/admin/rate-limit-refusals');

    const counts = within(screen.getByRole('list', { name: 'Refusals per limit' })).getAllByRole('listitem');
    expect(counts.map((c) => c.textContent)).toEqual(['2Sign-in (wrong passwords)', '1Site (signed-out requests)']);

    const list = document.querySelector('.rlr-list');
    const times = [...list.querySelectorAll('time')].map((t) => t.getAttribute('datetime'));
    expect(times).toEqual(['2026-10-23T18:05:00.000Z', '2026-10-23T18:04:00.000Z', '2026-10-23T18:03:00.000Z']);
    expect(list.textContent).toContain('POST /api/v1/auth/login');
    expect(list.textContent).toContain('198.51.100.x');
  });

  test('says the list clears when the server restarts', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { refusals: [], counts: {}, kept: 200 } } });
    render(<RateLimitRefusals />);
    expect(screen.getByText(/clears when the server restarts/)).toBeTruthy();
    expect(await screen.findByText('No refusals since the server last started.')).toBeTruthy();
  });

  test('a failed load says so; Refresh asks again', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(apiClient.get)
      .mockRejectedValueOnce(Object.assign(new Error('nope'), { response: { status: 503 } }))
      .mockResolvedValueOnce({ data: { data: payload } });
    render(<RateLimitRefusals />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(await screen.findAllByText('Sign-in (wrong passwords)')).toBeTruthy();
    err.mockRestore();
  });

  test('an unknown limit name is shown as it is', () => {
    expect(limitLabel('new-limit')).toBe('new-limit');
  });
});
