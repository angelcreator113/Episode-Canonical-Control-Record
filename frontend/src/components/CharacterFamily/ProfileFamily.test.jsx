/**
 * A Pulse profile's family line (Evoni, 2026-10-23): "Family: Jade Monroe (sister)".
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../../config/api', () => ({ API_URL: '/api/v1' }));

import api from '../../services/api';
import ProfileFamily from './ProfileFamily';

beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));

describe('ProfileFamily', () => {
  test('names each family member with their role, linked when they are a character', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { family: [
      { name: 'Jade Monroe', role: 'sister', character_id: 'jade', profile_id: 3 },
      { name: 'Aunt Bee', role: null, family: 'The Colemans' },
    ] } });
    render(<ProfileFamily profileId={7} />);
    const line = await screen.findByTestId('profile-family');
    expect(api.get).toHaveBeenCalledWith('/api/v1/families/profile/7');
    expect(line.textContent).toBe('Family: Jade Monroe (sister) · Aunt Bee (The Colemans)');
    expect(screen.getByRole('link', { name: 'Jade Monroe' }).getAttribute('href')).toBe('/character/jade');
  });

  test('no family, or a failed read: nothing shows', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { family: [] } });
    const { container, rerender } = render(<ProfileFamily profileId={7} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container.textContent).toBe('');
    vi.mocked(api.get).mockRejectedValueOnce(new Error('down'));
    rerender(<ProfileFamily profileId={8} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(container.textContent).toBe('');
  });
});
