/**
 * Event Package — Start Episode destination (Task #1905).
 *
 * Start Episode lands on Production -> Assets (`?tab=assets`), per Evoni's
 * ruling of 2026-09-25. EpisodeDetail's own default tab (Checklist, #1531)
 * is unchanged; this only pins where this caller sends her.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT_URL = '/api/v1/world/show-1/events/ev-1';
const START_URL = '/api/v1/world/show-1/events/ev-1/generate-episode';

// Every gate item set (organizer, name, category, format, date, World
// Location, invitation). Warning items (scene set, outfit, time, dress
// code, featured, stakes, money) are left open unless a test fills them.
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

// A fully complete event: no warnings, so Start Episode starts directly.
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

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="landed">{loc.pathname}{loc.search}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
      <Routes>
        <Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} />
        <Route path="/episodes/:episodeId" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('EventPackagePage — Start Episode lands on Production -> Assets', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    stored = JSON.parse(JSON.stringify(GATED_EVENT));
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === EVENT_URL) {
        return { data: {
          success: true, event: stored, sourceProfile: null, startedFromProfile: null,
          sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode: null,
        } };
      }
      return { data: { success: true, deliverables: [], locked: false } };
    });
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === START_URL) return { data: { success: true, data: { episode: { id: 'ep-9' } } } };
      return { data: { success: true } };
    });
  });

  test('with warnings open: Start Anyway navigates to /episodes/:id?tab=assets', async () => {
    renderPage();
    const start = await screen.findByTestId('start-episode');
    expect(start.disabled).toBe(false);

    fireEvent.click(start);
    fireEvent.click(await screen.findByTestId('start-anyway'));

    await waitFor(() => expect(screen.getByTestId('landed').textContent).toBe('/episodes/ep-9?tab=assets'));
    expect(api.post).toHaveBeenCalledWith(START_URL, { draft_script: false });
  });

  test('with no warnings: Start Episode starts directly and lands on ?tab=assets', async () => {
    stored = JSON.parse(JSON.stringify(COMPLETE_EVENT));
    renderPage();
    const start = await screen.findByTestId('start-episode');

    fireEvent.click(start);

    await waitFor(() => expect(screen.getByTestId('landed').textContent).toBe('/episodes/ep-9?tab=assets'));
    expect(screen.queryByTestId('start-confirm')).toBeNull();
  });
});
