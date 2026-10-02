/**
 * F2 (Evoni, 2026-10-01): attaching an event to an episode. "If the
 * scene-set link can't be made, the UI shows "Event attached · Scene set
 * needs reconnecting" with a Retry." In the event editor's Link to Episode.
 * F3: with no set chosen and several at the venue, Evoni chooses one.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';

const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Velour Launch', status: 'ready', prestige: 5, cost_coins: 10, scene_set_id: 'set-9',
  host: 'Mira', venue_name: 'The Glasshouse', event_date: '2026-11-02', canon_consequences: { automation: {} }, updated_at: '2026-10-01T00:00:00Z',
};
const EPISODES = [{ id: 'ep-1', episode_number: 1, title: 'Gala Night', status: 'draft' }];

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/world?tab=events&event=ev-1']}>
      <Routes>
        <Route path="/shows/:id/world" element={<WorldAdmin />} />
      </Routes>
    </MemoryRouter>
  );
}
const posted = (suffix) => vi.mocked(api.post).mock.calls.filter(([u]) => u.endsWith(suffix));

describe('WorldAdmin: attaching an event whose scene set can\'t be linked (F2)', () => {
  let retryResult;
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/events') return { data: { events: [EVENT] } };
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { episodes: EPISODES } };
      if (url === '/api/v1/shows/show-1') return { data: { id: 'show-1', title: 'Show' } };
      return { data: {} };
    });
    retryResult = { status: 'linked', scene_set_id: 'set-9', scene_set_name: 'The Glasshouse' };
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url.endsWith('/events/ev-1/inject')) {
        return { data: { success: true, attached: true, scene_set_linked: false, scene_set: { status: 'needs_reconnecting', scene_set_id: 'set-9', reason: 'The scene set could not be linked: boom' } } };
      }
      if (url.endsWith('/events/ev-1/scene-set-link')) return { data: { success: true, episode_id: 'ep-1', scene_set: retryResult } };
      return { data: { success: true, data: {} } };
    });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  async function attach() {
    renderEditor();
    fireEvent.click(await screen.findByText((_, el) => el?.tagName === 'BUTTON' && /^1\. Gala Night/.test(el.textContent)));
    await waitFor(() => expect(posted('/events/ev-1/inject')).toHaveLength(1));
    return screen.findByTestId('scene-set-reconnect');
  }

  test('says the event is attached and its scene set needs reconnecting; Retry links it', async () => {
    const banner = await attach();
    expect(banner.textContent).toContain('Event attached · Scene set needs reconnecting');
    expect(banner.textContent).toContain('The scene set could not be linked: boom');
    // Not shown as a success: the episode list stays, with no green panel in its place.
    expect(screen.getByText((_, el) => el?.tagName === 'BUTTON' && /^1\. Gala Night/.test(el.textContent))).toBeTruthy();

    fireEvent.click(within(banner).getByText('Retry'));
    await waitFor(() => expect(posted('/events/ev-1/scene-set-link')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByTestId('scene-set-reconnect')).toBeNull());
    expect(await screen.findByText('Scene set linked: “The Glasshouse”.')).toBeTruthy();
  });

  test('a Retry that still cannot link keeps the prompt, with the new reason', async () => {
    retryResult = { status: 'needs_reconnecting', scene_set_id: 'set-9', reason: 'The event\'s scene set no longer exists.' };
    const banner = await attach();
    fireEvent.click(within(banner).getByText('Retry'));
    await waitFor(() => expect(screen.getByTestId('scene-set-reconnect').textContent).toContain('no longer exists'));
  });

  test('several sets at the venue: Evoni chooses one, and it is linked (F3)', async () => {
    vi.mocked(api.post).mockImplementation(async (url, body) => {
      if (url.endsWith('/events/ev-1/inject')) {
        return { data: { success: true, attached: true, scene_set_linked: false, scene_set: {
          status: 'choose', scene_set_id: null, reason: 'The venue has several scene sets: choose one.',
          options: [{ id: 'set-day', name: 'Maison Belle: Day', base_still_url: 'https://cdn/d.jpg' }, { id: 'set-night', name: 'Maison Belle: Night', base_still_url: null }],
        } } };
      }
      if (url.endsWith('/events/ev-1/scene-set-link')) {
        return { data: { success: true, scene_set: { status: 'linked', scene_set_id: body.scene_set_id, scene_set_name: 'Maison Belle: Night' } } };
      }
      return { data: { success: true, data: {} } };
    });
    const banner = await attach();
    expect(banner.textContent).toContain('Event attached · Choose its scene set');
    expect(within(banner).queryByText('Retry')).toBeNull();
    expect(within(banner).getByTestId('scene-set-choice-set-night').textContent).toBe('Maison Belle: Night (no image yet)');

    fireEvent.click(within(banner).getByTestId('scene-set-choice-set-night'));
    await waitFor(() => expect(posted('/events/ev-1/scene-set-link')[0][1]).toEqual({ scene_set_id: 'set-night' }));
    await waitFor(() => expect(screen.queryByTestId('scene-set-reconnect')).toBeNull());
  });
});
