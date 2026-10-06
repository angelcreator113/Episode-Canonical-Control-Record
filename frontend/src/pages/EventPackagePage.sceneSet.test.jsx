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
import EventPackagePage, { orderSceneSetsForEvent, sceneSetPath, searchSceneSets, sceneSetThumb } from './EventPackagePage';

const EVENT_URL = '/api/v1/world/show-1/events/ev-1';
const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Velour Launch', event_type: 'invite', prestige: 6,
  venue_location_id: 'loc-1', venue_name: 'The Glasshouse', updated_at: '2026-10-01T10:00:00.000Z',
  canon_consequences: { automation: {} },
};
// GET /scene-sets returns every show's sets: another show's set is left out
// unless it is at the venue.
const SETS = [
  { id: 'set-other-b', name: 'Bistro', scene_type: 'OTHER', show_id: 'show-1', world_location_id: 'loc-9', base_still_url: 'x.jpg' },
  { id: 'set-venue-room', name: 'Glasshouse Lounge', scene_type: 'OTHER', show_id: 'show-2', world_location_id: 'loc-1', base_still_url: 'y.jpg' },
  { id: 'set-other-a', name: 'Atelier', scene_type: 'HOME_BASE', show_id: 'show-1', world_location_id: null, base_still_url: null },
  { id: 'set-venue-hall', name: 'Glasshouse Hall', scene_type: 'EVENT_LOCATION', show_id: 'show-1', world_location_id: 'loc-1', base_still_url: null },
  { id: 'set-foreign', name: 'Another Show Loft', scene_type: 'OTHER', show_id: 'show-2', world_location_id: 'loc-7', base_still_url: 'z.jpg' },
];
const BRIEF = {
  version: 1, scene_set_id: 'set-new', world_location_id: 'loc-1', event_id: 'ev-1', angle: 'WIDE',
  lines: [
    { layer: 'place', key: 'identity', label: 'Place', text: 'The Glasshouse.', source: 'venue', essential: true },
    { layer: 'event', key: 'concept', label: 'Event', text: 'Dressed for Velour Launch.', source: 'event', essential: true },
  ],
  rules: ['No people present.'], missing: [], overrides: {},
};

let stored;
let sceneSet;
let placeLocked;
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
    placeLocked = false;
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === EVENT_URL) {
        return { data: {
          success: true, event: stored, sourceProfile: null, startedFromProfile: null,
          sceneSet, venueLocation: null, invitationAsset: null, usedInEpisode: null, placeLocked,
          termsLockedBy: stored.used_in_episode_id ? { id: stored.used_in_episode_id } : null,
        } };
      }
      if (url === '/api/v1/scene-sets?show_id=show-1&limit=200&offset=0') return { data: { success: true, data: SETS } };
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
    const ids = (el) => within(el).getAllByRole('button')
      .filter((b) => b.dataset.testid?.startsWith('scene-set-option-'))
      .map((b) => b.dataset.testid.replace('scene-set-option-', ''));
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

  // S8 (Evoni, 2026-10-02; §8(dd)): the Place makes no images; its base is
  // made in Scene Sets.
  test('creating one for the venue: its World Location, chosen for the event; no brief and no image here', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Choose scene set' }));
    fireEvent.click(await screen.findByTestId('scene-set-create-open'));
    expect(screen.getByRole('textbox', { name: 'Scene set name' }).value).toBe('The Glasshouse');
    fireEvent.click(screen.getByRole('button', { name: 'Create scene set' }));

    await waitFor(() => expect(vi.mocked(api.put).mock.calls.some(([, b]) => b?.scene_set_id === 'set-new')).toBe(true));
    expect(posts('/api/v1/scene-sets')[0][1]).toEqual({ name: 'The Glasshouse', scene_type: 'EVENT_LOCATION', world_location_id: 'loc-1', show_id: 'show-1' });
    expect(screen.queryByTestId('scene-brief-confirm')).toBeNull();
    expect(posts('/generate-base')).toHaveLength(0);
    expect(posts('/scene-sets/set-new/brief')).toHaveLength(0);
  });

  // L13 (Evoni, 2026-10-02, §8(hh)) supersedes S7's read-only-after-Start:
  // the scene set stays changeable while the episode is a draft and locks
  // once it is accepted.
  test('after Start Episode, the episode a draft: the chosen set, still changeable, with a link to it', async () => {
    stored = { ...EVENT, scene_set_id: 'set-venue-hall', used_in_episode_id: 'ep-7', status: 'used' };
    sceneSet = SETS[3];
    placeLocked = false;
    renderPage();
    const link = await screen.findByTestId('place-scene-set-link');
    expect(link.textContent).toBe('Glasshouse Hall');
    expect(within(screen.getByTestId('place-scene-set')).getByRole('button').textContent).toBe('Change scene set');
    fireEvent.click(link);
    expect(screen.getByTestId('landed').textContent).toBe('/shows/show-1/world?tab=scene-sets&set=set-venue-hall');
  });

  test('the episode accepted: the chosen set, read-only', async () => {
    stored = { ...EVENT, scene_set_id: 'set-venue-hall', used_in_episode_id: 'ep-7', status: 'used' };
    sceneSet = SETS[3];
    placeLocked = true;
    renderPage();
    expect((await screen.findByTestId('place-scene-set-link')).textContent).toBe('Glasshouse Hall');
    expect(within(screen.getByTestId('place-scene-set')).queryByRole('button')).toBeNull();
  });

  test('orderSceneSetsForEvent and sceneSetPath', () => {
    const { atVenue, others } = orderSceneSetsForEvent(SETS, 'loc-1', 'show-1');
    expect(atVenue.map((x) => x.id)).toEqual(['set-venue-hall', 'set-venue-room']);
    expect(others.map((x) => x.id)).toEqual(['set-other-a', 'set-other-b']);
    expect(orderSceneSetsForEvent(SETS, null, 'show-1')).toEqual({
      atVenue: [], others: [expect.objectContaining({ id: 'set-other-a' }), expect.objectContaining({ id: 'set-other-b' }), expect.objectContaining({ id: 'set-venue-hall' })],
    });
    expect(orderSceneSetsForEvent(null, 'loc-1')).toEqual({ atVenue: [], others: [] });
    expect(sceneSetPath('show-1', 'set-1')).toBe('/shows/show-1/world?tab=scene-sets&set=set-1');
  });
});

// L2 (Evoni, 2026-10-02, §8(hh)) and her answer Q11: "The Place section's
// scene-set picker shows thumbnails, search and a preview of each set's
// angles"; "a strip of angle thumbnails under the highlighted set; search
// covers name, venue and type."
describe('Place: the scene-set picker shows thumbnails, search and angles (L2)', () => {
  const LOCATIONS = [{ id: 'loc-1', name: 'The Glasshouse' }, { id: 'loc-9', name: 'Rue Bistro' }];
  const ANGLED = SETS.map((s) => (s.id === 'set-venue-hall' ? {
    ...s,
    angles: [
      { id: 'ang-2', angle_label: 'CLOSE', angle_name: 'Bar close-up', sort_order: 2, still_image_url: 'close.jpg' },
      { id: 'ang-1', angle_label: 'WIDE', angle_name: 'Main hall', sort_order: 1, still_image_url: null },
    ],
    cover_angle_id: 'ang-2',
  } : s));

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    stored = { ...EVENT, scene_set_id: 'set-venue-hall' };
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === EVENT_URL) {
        return { data: {
          success: true, event: stored, sourceProfile: null, startedFromProfile: null,
          sceneSet: { id: 'set-venue-hall', name: 'Glasshouse Hall' }, venueLocation: null, invitationAsset: null, usedInEpisode: null,
        } };
      }
      if (url === '/api/v1/scene-sets?show_id=show-1&limit=200&offset=0') return { data: { success: true, data: ANGLED } };
      if (url === '/api/v1/world/locations') return { data: { success: true, locations: LOCATIONS } };
      return { data: { success: true, deliverables: [], locked: false } };
    });
  });

  test('each set shows a thumbnail (its base, else its cover angle) and its venue', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Change scene set' }));
    const bistro = await screen.findByTestId('scene-set-option-set-other-b');
    expect(bistro.querySelector('img').getAttribute('src')).toBe('x.jpg');
    await waitFor(() => expect(bistro.textContent).toContain('Rue Bistro'));
    expect(screen.getByTestId('scene-set-option-set-venue-hall').querySelector('img').getAttribute('src')).toBe('close.jpg');
    expect(screen.getByTestId('scene-set-option-set-other-a').querySelector('img')).toBeNull();
  });

  test("the event's set opens highlighted with its angles in order; another set's angles open on request", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Change scene set' }));
    const strip = await screen.findByTestId('scene-set-angles-set-venue-hall');
    expect(within(strip).getAllByRole('figure').map((f) => f.textContent)).toEqual(['No imageMain hall', 'Bar close-up']);

    fireEvent.click(screen.getByTestId('scene-set-preview-set-other-b'));
    expect(screen.getByTestId('scene-set-angles-set-other-b').textContent).toBe('No angles yet');
    expect(screen.queryByTestId('scene-set-angles-set-venue-hall')).toBeNull();
    expect(api.put).not.toHaveBeenCalled();
  });

  test('search covers name, venue and type', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Change scene set' }));
    // Venue names arrive with the World Locations.
    await waitFor(() => expect(screen.getByTestId('scene-set-option-set-other-b').textContent).toContain('Rue Bistro'));
    const search = screen.getByTestId('scene-set-search');
    const shown = () => screen.queryAllByTestId(/^scene-set-option-/).map((b) => b.dataset.testid.replace('scene-set-option-', '')).sort();

    fireEvent.change(search, { target: { value: 'atelier' } });
    expect(shown()).toEqual(['set-other-a']);
    fireEvent.change(search, { target: { value: 'rue bistro' } });
    expect(shown()).toEqual(['set-other-b']);
    fireEvent.change(search, { target: { value: 'home base' } });
    expect(shown()).toEqual(['set-other-a']);
    fireEvent.change(search, { target: { value: 'nothing like this' } });
    expect(shown()).toEqual([]);
    expect(screen.getByTestId('scene-set-no-match')).toBeTruthy();
  });

  test('the helpers: search with no query returns the groups; a thumb falls back to any angle image', () => {
    const groups = { atVenue: [SETS[3]], others: [SETS[0]] };
    expect(searchSceneSets(groups, '  ')).toBe(groups);
    expect(searchSceneSets(groups, 'event location', {})).toEqual({ atVenue: [SETS[3]], others: [] });
    expect(sceneSetThumb({ angles: [{ id: 'a', still_image_url: null }, { id: 'b', still_image_url: 'b.jpg' }] })).toBe('b.jpg');
    expect(sceneSetThumb({})).toBeNull();
    // The library cover (chosen in Scene Sets) comes before the main background.
    const angles = [{ id: 'a', still_image_url: 'a.jpg' }, { id: 'b', still_image_url: 'b.jpg' }];
    expect(sceneSetThumb({ base_still_url: 'base.jpg', angles })).toBe('base.jpg');
    expect(sceneSetThumb({ base_still_url: 'base.jpg', cover_angle_id: 'b', angles })).toBe('b.jpg');
    expect(sceneSetThumb({ base_still_url: 'base.jpg', cover_image_url: 'cover.jpg' })).toBe('cover.jpg');
    // A cover view with no image falls back to the main background.
    expect(sceneSetThumb({ base_still_url: 'base.jpg', cover_angle_id: 'c', angles: [{ id: 'c', still_image_url: null }] })).toBe('base.jpg');
  });
});
