/**
 * Event Package — the flow pieces on the page (Evoni, 2026-10-25: "I want
 * them all"): the strip under the header reads GET …/flow; the defaults and
 * clash lines sit beside their fields; with no warnings, Start goes straight
 * to the Episode Locations step, which shows what the start copies.
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
const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Velour Awards Night', event_type: 'invite', prestige: 6, category: 'arts_entertainment',
  format: 'gala', event_date: '2026-11-09', host_brand: 'Velour', venue_location_id: 'loc-1', invitation_asset_id: 'asset-inv-1',
  scene_set_id: 'set-1', outfit_set_id: 'outfit-1', event_time: '19:00', dress_code: 'Smart casual', narrative_stakes: 'Her first red carpet',
  cost_coins: 250, updated_at: '2026-09-25T10:00:00.000Z',
  canon_consequences: { pinned_goal_ids: ['g1'], automation: { guest_profiles: [{ id: 'g1', featured: true }, { id: 'g2' }] } },
};
const FLOW = {
  success: true,
  beat14: { episode_id: null, host: null, people: 2, attached: null, best: { id: 'o1', name: 'Velour SS27 campaign', fit: { best: true, reasons: [] } }, others: 0, draft: null },
  defaults: [{ field: 'dress_code', value: 'Black tie', source: 'brand', basis: "Velour's usual, 2 of its 2 other events" }, { field: 'prestige', value: 8, source: 'brand', basis: "Velour's usual, 2 of its 2 other events" }],
  clashes: { lines: [{ kind: 'day', field: 'date', text: 'Gallery Late is on the same day.' }, { kind: 'guest', field: 'guests', text: 'Nia is also at Gallery Late that day.' }] },
};

const renderPage = () => render(
  <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
    <Routes><Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} /></Routes>
  </MemoryRouter>
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === EVENT_URL) {
      return { data: { success: true, event: EVENT, sourceProfile: null, startedFromProfile: null, sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode: null } };
    }
    if (url === `${EVENT_URL}/flow`) return { data: FLOW };
    if (url === `${EVENT_URL}/episode-locations`) return { data: { success: true, data: { locations: [], missing: ['home', 'closet'] } } };
    return { data: { success: true, deliverables: [], locked: false } };
  });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true, event: EVENT } });
});

describe('EventPackagePage — where the event goes next', () => {
  test('the strip under the header: the clash line, beat 14, the actions', async () => {
    renderPage();
    const strip = await screen.findByTestId('event-flow-strip');
    await waitFor(() => expect(within(strip).getByTestId('beat14-name').textContent).toBe('Velour SS27 campaign'));
    expect(within(strip).getByTestId('clash-summary').textContent).toContain('2 things to check');
    expect(within(strip).getByTestId('fill-missing')).toBeTruthy();
    expect(within(strip).getByTestId('follow-up-event')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith(`${EVENT_URL}/flow`);
  });

  test('each default and clash beside its own section; a tapped chip saves that field', async () => {
    renderPage();
    const chip = await screen.findByTestId('default-chip-dress_code');
    expect(chip.closest('#epp-sec-identity')).toBeTruthy();
    expect(screen.getByTestId('default-chip-prestige').closest('#epp-sec-stakes')).toBeTruthy();
    expect(screen.getByTestId('clash-guest').closest('#epp-sec-people')).toBeTruthy();
    expect(screen.getByTestId('clash-day').closest('#epp-sec-identity')).toBeTruthy();
    fireEvent.click(chip);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(EVENT_URL, expect.objectContaining({ dress_code: 'Black tie' })));
  });

  test('with no warnings, the Episode Locations step shows what the start copies', async () => {
    renderPage();
    const start = await screen.findByTestId('start-episode');
    await waitFor(() => expect(start.disabled).toBe(false));
    fireEvent.click(start);
    const step = await screen.findByTestId('episode-locations-step');
    expect(within(step).getByTestId('start-copies').textContent)
      .toBe('Starting this copies: 1 goal, 2 guests (1 featured), the look, the venue and its set, the invitation.');
  });
});
