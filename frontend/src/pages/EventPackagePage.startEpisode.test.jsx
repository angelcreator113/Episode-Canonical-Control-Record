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
const LOCATIONS_URL = '/api/v1/world/show-1/events/ev-1/episode-locations';
const SETS_URL = '/api/v1/scene-sets?show_id=show-1';

const HOME = { id: 'set-home', name: 'Lala\'s Apartment', scene_type: 'HOME_BASE', show_id: 'show-1', base_still_url: null };
const LOFT = { id: 'set-loft', name: 'Downtown Loft', scene_type: 'HOME_BASE', show_id: 'show-1', base_still_url: null };
const CAR = { id: 'set-car', name: 'The Car', scene_type: 'OTHER', show_id: null, base_still_url: null };
const OTHER_SHOW = { id: 'set-x', name: 'Another Show Set', scene_type: 'HOME_BASE', show_id: 'show-2', base_still_url: null };

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
      if (url === LOCATIONS_URL) {
        return { data: { success: true, data: {
          locations: [{ role: 'home', scene_set_id: HOME.id, name: null, scene_set: HOME }],
          missing: ['event', 'closet'],
          defaults: { home_set_id: HOME.id, closet_set_id: null },
        } } };
      }
      if (url === SETS_URL) return { data: { success: true, data: [HOME, LOFT, CAR, OTHER_SHOW] } };
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
    fireEvent.click(await screen.findByTestId('els-confirm'));

    await waitFor(() => expect(screen.getByTestId('landed').textContent).toBe('/episodes/ep-9?tab=assets'));
    expect(api.post).toHaveBeenCalledWith(START_URL, {
      draft_script: false,
      locations: [{ role: 'home', scene_set_id: HOME.id, name: null }],
    });
  });

  test('with no warnings: Start Episode starts directly and lands on ?tab=assets', async () => {
    stored = JSON.parse(JSON.stringify(COMPLETE_EVENT));
    renderPage();
    const start = await screen.findByTestId('start-episode');

    fireEvent.click(start);
    fireEvent.click(await screen.findByTestId('els-confirm'));

    await waitFor(() => expect(screen.getByTestId('landed').textContent).toBe('/episodes/ep-9?tab=assets'));
    expect(screen.queryByTestId('start-confirm')).toBeNull();
  });
});

// The Episode Locations step (L3, L6, Q12–Q15; Evoni, 2026-10-02).
describe('EventPackagePage — the Episode Locations step at Start Episode', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    stored = JSON.parse(JSON.stringify(COMPLETE_EVENT));
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === EVENT_URL) {
        return { data: {
          success: true, event: stored, sourceProfile: null, startedFromProfile: null,
          sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode: null,
        } };
      }
      if (url === LOCATIONS_URL) {
        return { data: { success: true, data: {
          locations: [{ role: 'home', scene_set_id: HOME.id, name: null, scene_set: HOME }],
          missing: ['event', 'closet'],
          defaults: { home_set_id: HOME.id, closet_set_id: null },
        } } };
      }
      if (url === SETS_URL) return { data: { success: true, data: [HOME, LOFT, CAR, OTHER_SHOW] } };
      return { data: { success: true, deliverables: [], locked: false } };
    });
    vi.mocked(api.post).mockImplementation(async (url, body) => {
      if (url === START_URL) return { data: { success: true, data: { episode: { id: 'ep-9' } } } };
      if (url === '/api/v1/scene-sets') return { data: { success: true, data: { id: 'set-new', show_id: 'show-1', ...body } } };
      return { data: { success: true } };
    });
  });

  test('shows the proposal and asks for a role with no default; nothing is created before Confirm', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('start-episode'));
    const step = await screen.findByTestId('episode-locations-step');
    expect(screen.getByTestId('els-row-home').textContent).toContain("Lala's Apartment");
    expect(screen.getByTestId('els-row-closet').textContent).toContain('No saved default: choose one.');
    expect(step).toBeTruthy();
    expect(api.post).not.toHaveBeenCalledWith(START_URL, expect.anything());

    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByTestId('episode-locations-step')).toBeNull());
    expect(api.post).not.toHaveBeenCalledWith(START_URL, expect.anything());
  });

  test('changing home, adding a named extra and creating a closet are sent with Start', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('start-episode'));
    await screen.findByTestId('episode-locations-step');

    // Home → Downtown Loft. Another show's set is not offered.
    fireEvent.click(screen.getByTestId('els-change-home'));
    await screen.findByTestId('els-option-set-loft');
    expect(screen.queryByTestId('els-option-set-x')).toBeNull();
    fireEvent.click(screen.getByTestId('els-option-set-loft'));

    // Closet: "+ Create" returns with the new set selected.
    fireEvent.click(screen.getByTestId('els-change-closet'));
    fireEvent.change(screen.getByLabelText('New scene set name'), { target: { value: 'Walk-in Closet' } });
    fireEvent.click(screen.getByText('+ Create'));
    await waitFor(() => expect(screen.getByTestId('els-row-closet').textContent).toContain('Walk-in Closet'));
    expect(api.post).toHaveBeenCalledWith('/api/v1/scene-sets', { name: 'Walk-in Closet', scene_type: 'CLOSET', show_id: 'show-1' });

    // An extra needs a name before Confirm.
    fireEvent.click(screen.getByTestId('els-add-extra'));
    fireEvent.click(await screen.findByTestId('els-option-set-car'));
    expect(screen.getByText('Name each extra location.')).toBeTruthy();
    expect(screen.getByTestId('els-confirm').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Extra location 1 name'), { target: { value: 'Car' } });

    fireEvent.click(screen.getByTestId('els-confirm'));
    await waitFor(() => expect(screen.getByTestId('landed').textContent).toBe('/episodes/ep-9?tab=assets'));
    expect(api.post).toHaveBeenCalledWith(START_URL, {
      draft_script: false,
      locations: [
        { role: 'home', scene_set_id: 'set-loft', name: null },
        { role: 'closet', scene_set_id: 'set-new', name: null },
        { role: 'extra', scene_set_id: 'set-car', name: 'Car' },
      ],
    });
  });

  test('one set cannot hold two roles', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('start-episode'));
    await screen.findByTestId('episode-locations-step');
    fireEvent.click(screen.getByTestId('els-change-closet'));
    fireEvent.click(await screen.findByTestId('els-option-set-home'));
    expect(screen.getByText('A scene set holds one role in an episode.')).toBeTruthy();
    expect(screen.getByTestId('els-confirm').disabled).toBe(true);
  });

  test('a refused Start shows the server error and keeps the step open', async () => {
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === START_URL) {
        const err = new Error('Request failed');
        err.response = { status: 400, data: { success: false, error: 'This scene set belongs to another show' } };
        throw err;
      }
      return { data: { success: true } };
    });
    renderPage();
    fireEvent.click(await screen.findByTestId('start-episode'));
    fireEvent.click(await screen.findByTestId('els-confirm'));
    await screen.findByText('This scene set belongs to another show');
    expect(screen.getByTestId('episode-locations-step')).toBeTruthy();
  });
});
