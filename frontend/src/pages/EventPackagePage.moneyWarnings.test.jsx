/**
 * Episode Money Phase B, MB4 (Evoni, 2026-10-01; EVENT_EPISODE_FLOW.md
 * §8(gg)): "If the projected balance would go below zero, or event spending
 * exceeds what Lala has, the Money tab and Start Episode/Complete warn early
 * with the shortfall." On the Event Package the warning shows in Review and
 * in the Start Anyway confirm; it never blocks Start Episode.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

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
let preview;
const PREVIEW_URL = '/api/v1/world/show-1/events/ev-1/money-preview';
const WARNING = {
  code: 'COSTS_EXCEED_BALANCE', shortfall: 60, costs: 160, have: 100,
  message: "This episode's costs and spending (160) are more than Lala has (100): 60 short if the income does not arrive.",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
      <Routes>
        <Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} />
        <Route path="/episodes/:episodeId" element={<div data-testid="landed">landed</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('EventPackagePage money warnings (§8(gg) MB4)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    stored = JSON.parse(JSON.stringify(COMPLETE_EVENT));
    preview = { balance: 100, projection: { projected_balance: 240 }, warnings: [WARNING], lines: [] };
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === EVENT_URL) {
        return { data: {
          success: true, event: stored, sourceProfile: null, startedFromProfile: null,
          sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode: null,
        } };
      }
      if (url === PREVIEW_URL) return { data: { success: true, data: preview } };
      return { data: { success: true, deliverables: [], locked: false } };
    });
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === START_URL) return { data: { success: true, data: { episode: { id: 'ep-9' } } } };
      return { data: { success: true } };
    });
  });

  test('Review shows the money warning with its shortfall, and says it does not block', async () => {
    renderPage();
    const block = await screen.findByTestId('money-warnings');
    expect(block.textContent).toContain(WARNING.message);
    expect(block.textContent).toContain('Start Episode stays open');
    expect(screen.getByTestId('start-episode').disabled).toBe(false);
  });

  test('an otherwise complete event asks first when money warns, then Start Anyway starts it', async () => {
    renderPage();
    await screen.findByTestId('money-warnings');
    fireEvent.click(screen.getByTestId('start-episode'));

    const confirm = await screen.findByTestId('start-confirm');
    expect(confirm.textContent).toContain('Start with 1 warning?');
    expect(screen.getByTestId('start-money-warning-COSTS_EXCEED_BALANCE').textContent).toContain('60 short');
    expect(api.post).not.toHaveBeenCalledWith(START_URL, expect.anything());

    fireEvent.click(screen.getByTestId('start-anyway'));
    // Then the Episode Locations step (L3, §8(hh)); Confirm starts it.
    fireEvent.click(await screen.findByTestId('els-confirm'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(START_URL, { draft_script: false, locations: [] }));
  });

  test('no money warning: no block, and a complete event starts directly', async () => {
    preview = { ...preview, warnings: [] };
    renderPage();
    const start = await screen.findByTestId('start-episode');
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(PREVIEW_URL));
    expect(screen.queryByTestId('money-warnings')).toBeNull();
    fireEvent.click(start);
    fireEvent.click(await screen.findByTestId('els-confirm'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(START_URL, { draft_script: false, locations: [] }));
    expect(screen.queryByTestId('start-confirm')).toBeNull();
  });
});
