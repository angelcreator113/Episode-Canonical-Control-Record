/**
 * Show Settings → Lala's home (D13 travel, Evoni 2026-09-30): a show setting
 * read and saved through /api/v1/shows/:id/lala-home.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import { LalaHomeBlock } from './ShowSettings';

const HOME = { address: '246 Olddy Paveway Ln', neighbourhood: 'Echo Park', city: 'Los Angeles' };

describe("LalaHomeBlock", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, lala_home: HOME } });
  });

  test('shows the stored home, and saves an edit', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { success: true, lala_home: { ...HOME, neighbourhood: 'Silver Lake' } } });
    const onToast = vi.fn();
    render(<LalaHomeBlock showId="show-1" onToast={onToast} />);
    await waitFor(() => expect(screen.getByTestId('lala-home-city').value).toBe('Los Angeles'));
    expect(api.get).toHaveBeenCalledWith('/api/v1/shows/show-1/lala-home');
    expect(screen.queryByTestId('lala-home-save')).toBeNull();
    fireEvent.change(screen.getByTestId('lala-home-neighbourhood'), { target: { value: 'Silver Lake' } });
    fireEvent.click(screen.getByTestId('lala-home-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/shows/show-1/lala-home', { ...HOME, neighbourhood: 'Silver Lake' }));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith("Lala's home saved"));
  });

  test('the city is required', async () => {
    const onToast = vi.fn();
    render(<LalaHomeBlock showId="show-1" onToast={onToast} />);
    await waitFor(() => expect(screen.getByTestId('lala-home-city').value).toBe('Los Angeles'));
    fireEvent.change(screen.getByTestId('lala-home-city'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('lala-home-save'));
    expect(onToast).toHaveBeenCalledWith('The city is required: it decides when Lala travels', 'error');
    expect(api.put).not.toHaveBeenCalled();
  });
});
