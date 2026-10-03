/**
 * Recommended looks (Evoni, 2026-10-03, episode creation step 3): while no
 * outfit is chosen, the Style section offers whole looks from Lala's
 * closet, built from each piece's event match, and Use this look saves one
 * through the closet picker's own PUT.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT_URL = '/api/v1/world/show-1/events/ev-1';
const PREVIEW_URL = '/api/v1/world/show-1/events/ev-1/money-preview';
const OPTIONS_URL = '/api/v1/world/show-1/events/ev-1/wardrobe-options';
const OUTFIT_URL = '/api/v1/world/show-1/events/ev-1/outfit';

// Every gate set; warnings (scene set, outfit, time, dress code, featured,
// stakes, money) open unless a test fills them.
const GATED_EVENT = {
  id: 'ev-1',
  show_id: 'show-1',
  name: 'Velour Awards Night',
  event_type: 'invite',
  prestige: 6,
  category: 'arts_entertainment',
  format: 'gala',
  event_date: '2026-11-09',
  host_brand: 'Velour',
  venue_location_id: 'loc-1',
  invitation_asset_id: 'asset-inv-1',
  updated_at: '2026-09-25T10:00:00.000Z',
  canon_consequences: { automation: {} },
};

const COMPLETE_EVENT = {
  ...GATED_EVENT,
  scene_set_id: 'set-1',
  outfit_set_id: 'outfit-1',
  event_time: '19:00',
  dress_code: 'Black tie',
  narrative_stakes: 'Her first red carpet',
  cost_coins: 250,
  canon_consequences: { automation: { guest_profiles: [{ id: 'g1', featured: true }] } },
};

let stored;
let preview;
let closet;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
      <Routes>
        <Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  preview = null;
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === EVENT_URL) {
      return { data: {
        success: true, event: stored, sourceProfile: null, startedFromProfile: null,
        sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode: null,
      } };
    }
    if (url === PREVIEW_URL) return { data: { success: true, data: preview } };
    if (url === OPTIONS_URL) return { data: { success: true, items: closet } };
    return { data: { success: true, deliverables: [], locked: false } };
  });
  vi.mocked(api.put).mockImplementation(async (url, body) => {
    if (url === OUTFIT_URL) {
      stored = { ...stored, outfit_pieces: body.wardrobe_ids.map((id) => ({ id, name: id })) };
      return { data: { success: true, pieces: stored.outfit_pieces } };
    }
    stored = { ...stored, ...body, updated_at: '2026-09-25T10:05:00.000Z' };
    return { data: { success: true, event: stored } };
  });
});

const piece = (id, clothing_category, event_match, extra = {}) => ({
  id, name: id, clothing_category, event_match, is_owned: true, coin_cost: 0, ...extra,
});

describe('recommended looks in Style', () => {
  beforeEach(() => {
    closet = [
      piece('lavender-midi', 'dress', 92),
      piece('silk-gown', 'gown', 95, { is_owned: false, coin_cost: 510 }),
      piece('gold-sandals', 'sandals', 90),
      piece('gold-hoops', 'earrings', 88),
    ];
  });

  test('with no outfit chosen, whole looks are offered with match and what to buy', async () => {
    stored = { ...COMPLETE_EVENT, outfit_set_id: null, outfit_pieces: [] };
    renderPage();
    const looks = await screen.findByTestId('looks');
    const a = within(looks).getByTestId('look-look-a');
    expect(a.textContent).toMatch(/lavender-midi/);
    expect(within(a).getByTestId('look-match').textContent).toBe(`${Math.round((92 + 90 + 88) / 3)}% event match`);
    expect(within(a).getByTestId('look-cost').textContent).toBe('Lala owns every piece.');
    const b = within(looks).getByTestId('look-look-b');
    expect(within(b).getByTestId('look-cost').textContent).toMatch(/1 piece to buy · 510 coins/);
  });

  test('Use this look saves the look through the outfit PUT and the Style section shows it', async () => {
    stored = { ...COMPLETE_EVENT, outfit_set_id: null, outfit_pieces: [] };
    renderPage();
    const a = await screen.findByTestId('look-look-a');
    fireEvent.click(within(a).getByTestId('look-use'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(OUTFIT_URL, { wardrobe_ids: ['lavender-midi', 'gold-sandals', 'gold-hoops'] }));
    await waitFor(() => expect(screen.getByTestId('style-outfit-summary').textContent).toBe('3 pieces chosen'));
    expect(screen.queryByTestId('looks')).toBeNull();
  });

  test('Build another opens the closet picker', async () => {
    stored = { ...COMPLETE_EVENT, outfit_set_id: null, outfit_pieces: [] };
    renderPage();
    fireEvent.click(await screen.findByTestId('looks-browse'));
    expect(await screen.findByTestId('outfit-picker')).toBeTruthy();
  });

  test('no looks once an outfit is chosen, and none on a used event', async () => {
    stored = { ...COMPLETE_EVENT, outfit_pieces: [{ id: 'p1', name: 'Chosen dress' }] };
    const { unmount } = renderPage();
    await screen.findByTestId('style-outfit-summary');
    expect(screen.queryByTestId('looks')).toBeNull();
    expect(api.get).not.toHaveBeenCalledWith(OPTIONS_URL);
    unmount();

    stored = { ...COMPLETE_EVENT, outfit_pieces: [], used_in_episode_id: 'ep-1' };
    renderPage();
    await screen.findByTestId('terms-locked-banner');
    expect(screen.queryByTestId('looks')).toBeNull();
  });
});
