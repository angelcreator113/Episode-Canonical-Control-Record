/**
 * The Event Package's Place section: the scene set for the event (ruling
 * S7, Evoni 2026-10-01; EVENT_EPISODE_FLOW.md §8(dd)): "The Event Package's
 * Place section lets Evoni choose a scene set for the event (the venue's own
 * sets listed first) or create one for the venue. Creating opens the Scene
 * Brief with this event chosen (S3) and the venue's World Location linked
 * (S5), shows the cost, then generates the base. After Start Episode the
 * chosen set is shown read-only with a link to it."
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage, { orderSceneSetsForEvent, sceneSetPath } from './EventPackagePage';

const EVENT_URL = '/api/v1/world/show-1/events/ev-1';
const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Velour Launch', event_type: 'invite', prestige: 6,
  venue_location_id: 'loc-1', venue_name: 'The Glasshouse', updated_at: '2026-10-01T10:00:00.000Z',
  canon_consequences: { automation: {} },
};
const SETS = [
  { id: 'set-other-b', name: 'Bistro', scene_type: 'OTHER', world_location_id: 'loc-9', base_still_url: 'x.jpg' },
  { id: 'set-venue-room', name: 'Glasshouse Lounge', scene_type: 'OTHER', world_location_id: 'loc-1', base_still_url: 'y.jpg' },
  { id: 'set-other-a', name: 'Atelier', scene_type: 'HOME_BASE', world_location_id: null, base_still_url: null },
  { id: 'set-venue-hall', name: 'Glasshouse Hall', scene_type: 'EVENT_LOCATION', world_location_id: 'loc-1', base_still_url: null },
];
const BRIEF = {
  version: 1, scene_set_id: 'set-new', world_location_id: 'loc-1', event_id: 'ev-1', angle: 'WIDE',
  lines: [
    { layer: 'place', key: 'identity', label: 'Place', text: 'The Glasshouse.', source: 'venue', essential: true },
    { layer: 'event', key: 'concept', label: 'Event', text: 'Dressed for Velour Launch.', source: 'event', essential: true },
  ],
  rules: ['An empty space with no people.'], missing: [], overrides: {},
};

let stored;
let sceneSet;
function Probe() {
  const loc = useLocation();
  return <div data-testid="landed">{loc.pathname}{loc.search}</div>;
}
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
      <Routes>
        <Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} />
        <Route path="/shows/:id/world" element={<Probe />} />
      </Routes>
    </MemoryRouter>
  );
}
const posts = (suffix) => vi.mocked(api.post).mock.calls.filter(([u]) => u.endsWith(suffix));

describe('Place: the scene set for the event (S7)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    stored = { ...EVENT };
    sceneSet = null;
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === EVENT_URL) {
        return { data: {
          success: true, event: stored, sourceProfile: null, startedFromProfile: null,
          sceneSet, venueLocation: null, invitationAsset: null, usedInEpisode: null,
          termsLockedBy: stored.used_in_episode_id ? { id: stored.used_in_episode_id } : null,
        } };
      }
      if (url === '/api/v1/scene-sets?show_id=show-1&limit=200') return { data: { success: true, data: SETS } };
      if (url === '/api/v1/world/show-1/events') return { data: { success: true, events: [EVENT] } };
      return { data: { success: true, deliverables: [], locked: false } };
    });
    vi.mocked(api.put).mockImplementation(async (_url, body) => {
      stored = { ...stored, ...body, updated_at: '2026-10-01T10:00:01.000Z' };
      if (body.scene_set_id) sceneSet = [...SETS, { id: 'set-new', name: 'The Glasshouse' }].find((s) => s.id === body.scene_set_id) || null;
      return { data: { success: true, event: stored } };
    });
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === '/api/v1/scene-sets') return { data: { success: true, data: { id: 'set-new', name: 'The Glasshouse', scene_type: 'EVENT_LOCATION', world_location_id: 'loc-1' } } };
      if (url.endsWith('/scene-sets/set-new/brief')) return { data: { success: true, data: { target: { kind: 'base' }, brief: BRIEF, estimate: { usd: 0.03, priced: true } } } };
      if (url.endsWith('/generate-base')) return { data: { success: true, data: { status: 'generating' } } };
      return { data: { success: true } };
    });
  });

  test('every scene set of the show is offered, the venue\'s own first; choosing one saves it', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Choose scene set' }));
    const venueGroup = await screen.findByTestId('scene-set-group-venue');
    expect(within(venueGroup).getByText('At The Glasshouse')).toBeTruthy();
    const ids = (el) => within(el).getAllByRole('button').map((b) => b.dataset.testid.replace('scene-set-option-', ''));
    expect(ids(venueGroup)).toEqual(['set-venue-hall', 'set-venue-room']);
    expect(ids(screen.getByTestId('scene-set-group-others'))).toEqual(['set-other-a', 'set-other-b']);

    fireEvent.click(screen.getByTestId('scene-set-option-set-other-b'));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(vi.mocked(api.put).mock.calls[0][1]).toMatchObject({ scene_set_id: 'set-other-b' });
    expect(await screen.findByTestId('place-scene-set-link')).toBeTruthy();
  });

  test('with no venue: a set can be chosen, not created', async () => {
    stored = { ...EVENT, venue_location_id: null, venue_name: null };
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Choose scene set' }));
    expect(await screen.findByTestId('scene-set-needs-venue')).toBeTruthy();
    expect(screen.queryByTestId('scene-set-group-venue')).toBeNull();
    expect(screen.queryByTestId('scene-set-create-open')).toBeNull();
  });

  test('creating one for the venue: its World Location, chosen for the event, then its brief for this event with the cost; generated on confirm', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Choose scene set' }));
    fireEvent.click(await screen.findByTestId('scene-set-create-open'));
    expect(screen.getByRole('textbox', { name: 'Scene set name' }).value).toBe('The Glasshouse');
    fireEvent.click(screen.getByRole('button', { name: 'Create & open its brief' }));

    await screen.findByTestId('scene-brief-confirm');
    expect(posts('/api/v1/scene-sets')[0][1]).toEqual({ name: 'The Glasshouse', scene_type: 'EVENT_LOCATION', world_location_id: 'loc-1', show_id: 'show-1' });
    expect(vi.mocked(api.put).mock.calls[0][1]).toMatchObject({ scene_set_id: 'set-new' });
    await waitFor(() => expect(posts('/scene-sets/set-new/brief')).toHaveLength(1));
    expect(posts('/scene-sets/set-new/brief')[0][1]).toEqual({ event_id: 'ev-1' });
    expect(screen.getByTestId('sbc-confirm').textContent).toBe('Generate — est. $0.03');
    expect(posts('/generate-base')).toHaveLength(0);

    fireEvent.click(screen.getByTestId('sbc-confirm'));
    await waitFor(() => expect(posts('/scene-sets/set-new/generate-base')).toHaveLength(1));
    expect(posts('/scene-sets/set-new/generate-base')[0][1]).toEqual({ overrides: {}, event_id: 'ev-1' });
    expect(screen.queryByTestId('scene-brief-confirm')).toBeNull();
  });

  test('cancelling the brief keeps the set chosen and generates nothing', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Choose scene set' }));
    fireEvent.click(await screen.findByTestId('scene-set-create-open'));
    fireEvent.click(screen.getByRole('button', { name: 'Create & open its brief' }));
    await screen.findByTestId('scene-brief-confirm');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('scene-brief-confirm')).toBeNull();
    expect(posts('/generate-base')).toHaveLength(0);
    expect(screen.getByTestId('place-scene-set-link').textContent).toBe('The Glasshouse');
  });

  test('after Start Episode: the chosen set, read-only, with a link to it', async () => {
    stored = { ...EVENT, scene_set_id: 'set-venue-hall', used_in_episode_id: 'ep-7', status: 'used' };
    sceneSet = SETS[3];
    renderPage();
    const link = await screen.findByTestId('place-scene-set-link');
    expect(link.textContent).toBe('Glasshouse Hall');
    expect(within(screen.getByTestId('place-scene-set')).queryByRole('button')).toBeNull();
    fireEvent.click(link);
    expect(screen.getByTestId('landed').textContent).toBe('/shows/show-1/world?tab=scene-sets&set=set-venue-hall');
  });

  test('orderSceneSetsForEvent and sceneSetPath', () => {
    const { atVenue, others } = orderSceneSetsForEvent(SETS, 'loc-1');
    expect(atVenue.map((x) => x.id)).toEqual(['set-venue-hall', 'set-venue-room']);
    expect(others.map((x) => x.id)).toEqual(['set-other-a', 'set-other-b']);
    expect(orderSceneSetsForEvent(SETS, null).atVenue).toEqual([]);
    expect(orderSceneSetsForEvent(null, 'loc-1')).toEqual({ atVenue: [], others: [] });
    expect(sceneSetPath('show-1', 'set-1')).toBe('/shows/show-1/world?tab=scene-sets&set=set-1');
  });
});
