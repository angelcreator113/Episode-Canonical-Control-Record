/**
 * Trust on The Pulse (services/pulseTrust): three levels, saved on choosing;
 * what always waits is always listed.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import PulseTrust from './PulseTrust';

describe('PulseTrust', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, level: 'trusted' } });
    vi.mocked(api.put).mockResolvedValue({ data: { success: true, level: 'full' } });
  });

  test('shows their level and saves another', async () => {
    render(<PulseTrust profileId={7} />);
    const trusted = await screen.findByRole('radio', { name: /^Trusted/ });
    expect(trusted.checked).toBe(true);
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-trust/profiles/7');
    fireEvent.click(screen.getByRole('radio', { name: /Fully trusted/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-trust/profiles/7', { level: 'full' }));
    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Fully trusted/ }).checked).toBe(true);
  });

  test('what always waits is listed at every level', async () => {
    render(<PulseTrust profileId={7} />);
    const text = (await screen.findByTestId('pulse-trust')).textContent;
    for (const line of ['Deal announcements', 'reveals a secret or a story turn', 'Anything about Lala', 'New canon facts']) expect(text).toContain(line);
  });

  test('a failed save says so and keeps their level', async () => {
    vi.mocked(api.put).mockRejectedValueOnce({ response: { data: { error: 'Nope.' } } });
    render(<PulseTrust profileId={7} />);
    fireEvent.click(await screen.findByRole('radio', { name: /Review everything/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Nope.');
    expect(screen.getByRole('radio', { name: /^Trusted/ }).checked).toBe(true);
  });
});
