/**
 * D2 (Evoni, 2026-10-02): "a one-click 'Move my beats to…' for an episode
 * whose beats point at removed sets (choose replacements per removed set)."
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import RemovedSetsBanner from './RemovedSetsBanner';

const REMOVED = [
  { scene_set_id: 'gone-closet', name: "Lala's Closet", beats: [4, 5, 6, 7] },
  { scene_set_id: 'gone-room', name: "Lala's Room", beats: [1, 2, 3, 13, 14] },
];
const LIBRARY = [
  { id: 'new-closet', name: "lala's closet", show_id: null },
  { id: 'new-bed', name: "Lala's bedroom", show_id: null },
  { id: 'studio', name: 'Studio', show_id: 'show-1' },
];

describe('RemovedSetsBanner (D2)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/ep-1/removed-sets') return { data: { data: REMOVED } };
      if (url === '/api/v1/scene-sets?show_id=show-1&limit=200&offset=0') return { data: { data: LIBRARY } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
  });

  test('names each removed set and its beats; one click moves them all to the chosen sets', async () => {
    const onMoved = vi.fn();
    render(<RemovedSetsBanner episodeId="ep-1" showId="show-1" onMoved={onMoved} />);
    const banner = await screen.findByTestId('removed-sets-banner');
    expect(within(banner).getByText("Lala's Closet (beats 4, 5, 6, 7)")).toBeTruthy();
    expect(within(banner).getByText("Lala's Room (beats 1, 2, 3, 13, 14)")).toBeTruthy();
    const move = within(banner).getByRole('button', { name: 'Move my beats' });
    expect(move.disabled).toBe(true);
    const closet = within(banner).getByLabelText("Replacement for Lala's Closet");
    await waitFor(() => expect(within(closet).getAllByRole('option')).toHaveLength(4));
    fireEvent.change(closet, { target: { value: 'new-closet' } });
    fireEvent.change(within(banner).getByLabelText("Replacement for Lala's Room"), { target: { value: 'new-bed' } });
    expect(move.disabled).toBe(false);
    fireEvent.click(move);
    await waitFor(() => expect(onMoved).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith('/api/v1/episodes/ep-1/move-removed-sets', {
      moves: [{ from: 'gone-closet', to: 'new-closet' }, { from: 'gone-room', to: 'new-bed' }],
    });
  });

  test('shows nothing when no beat points at a removed set', async () => {
    vi.mocked(api.get).mockImplementation(async () => ({ data: { data: [] } }));
    const { container } = render(<RemovedSetsBanner episodeId="ep-1" showId="show-1" onMoved={vi.fn()} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });
});
