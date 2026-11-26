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

  // P1 (Evoni, 2026-11-26): moving is switched off server-side (503
  // MOVE_REMOVED_SETS_DISABLED), because it could rewrite an episode that has
  // been accepted or filmed. Everything this banner REPORTS is unchanged —
  // which sets were removed, which beats point at them, and which
  // replacements would be offered — and the button now says so instead of
  // failing when it is pressed. This replaces the one-click move this case
  // asserted while the action was live.
  test('names each removed set and its beats, and still offers the replacements, with moving unavailable', async () => {
    const onMoved = vi.fn();
    render(<RemovedSetsBanner episodeId="ep-1" showId="show-1" onMoved={onMoved} />);
    const banner = await screen.findByTestId('removed-sets-banner');
    expect(within(banner).getByText("Lala's Closet (beats 4, 5, 6, 7)")).toBeTruthy();
    expect(within(banner).getByText("Lala's Room (beats 1, 2, 3, 13, 14)")).toBeTruthy();

    // The explanation is shown, and says what to do instead.
    const why = within(banner).getByText(/Moving the beats automatically is unavailable/);
    expect(why.textContent).toMatch(/accepted or filmed/);
    expect(why.textContent).toMatch(/Locations and Beat Plan/);
    expect(why.textContent).toMatch(/Resume setup/);

    // The replacement lists still load and still filter by show.
    const closet = within(banner).getByLabelText("Replacement for Lala's Closet");
    await waitFor(() => expect(within(closet).getAllByRole('option')).toHaveLength(4));

    // The button is disabled before and after a replacement is chosen, and
    // pressing it sends nothing.
    const move = within(banner).getByRole('button', { name: 'Move my beats' });
    expect(move.disabled).toBe(true);
    fireEvent.change(closet, { target: { value: 'new-closet' } });
    fireEvent.change(within(banner).getByLabelText("Replacement for Lala's Room"), { target: { value: 'new-bed' } });
    expect(move.disabled).toBe(true);
    fireEvent.click(move);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(api.post).not.toHaveBeenCalled();
    expect(onMoved).not.toHaveBeenCalled();
  });

  test('shows nothing when no beat points at a removed set', async () => {
    vi.mocked(api.get).mockImplementation(async () => ({ data: { data: [] } }));
    const { container } = render(<RemovedSetsBanner episodeId="ep-1" showId="show-1" onMoved={vi.fn()} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  // Evoni, 2026-10-07: only sets a beat still uses; leftover links don't raise the bar.
  test('a removed set no beat uses is not listed; with none left, nothing shows', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/ep-1/removed-sets') {
        return { data: { data: [...REMOVED, { scene_set_id: 'gone-house', name: 'Lalas house', beats: [] }] } };
      }
      if (url === '/api/v1/scene-sets?show_id=show-1&limit=200&offset=0') return { data: { data: LIBRARY } };
      return { data: {} };
    });
    render(<RemovedSetsBanner episodeId="ep-1" showId="show-1" onMoved={vi.fn()} />);
    const banner = await screen.findByTestId('removed-sets-banner');
    expect(within(banner).queryByText(/Lalas house/)).toBeNull();
    expect(within(banner).getAllByRole('listitem')).toHaveLength(2);

    vi.mocked(api.get).mockImplementation(async () => ({ data: { data: [{ scene_set_id: 'gone-house', name: 'Lalas house', beats: [] }] } }));
    const { container } = render(<RemovedSetsBanner episodeId="ep-2" showId="show-1" onMoved={vi.fn()} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-2/removed-sets'));
    expect(container.innerHTML).toBe('');
  });

  // Eighth audit (2026-10-19).
  test("another show's sets are not offered, and a failed list says so", async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/ep-1/removed-sets') return { data: { data: REMOVED } };
      if (url.startsWith('/api/v1/scene-sets?show_id=show-1')) return { data: { data: [...LIBRARY, { id: 'franchise', name: 'Other show loft', show_id: 'show-9' }] } };
      return { data: {} };
    });
    const first = render(<RemovedSetsBanner episodeId="ep-1" showId="show-1" />);
    const select = await screen.findByLabelText("Replacement for Lala's Closet");
    await waitFor(() => expect(select.querySelectorAll('option').length).toBe(4));
    expect([...select.querySelectorAll('option')].map((o) => o.value)).not.toContain('franchise');
    first.unmount();

    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/ep-1/removed-sets') return { data: { data: REMOVED } };
      throw new Error('network');
    });
    render(<RemovedSetsBanner episodeId="ep-1" showId="show-1" />);
    expect((await screen.findByText(/Could not load the scene sets/)).textContent).toMatch(/Reload the page/);
  });
});
