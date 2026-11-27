/**
 * The Event Package's way back to the episode it was opened from (Evoni,
 * 2026-11-27). A checklist Fix for the venue image or the invitation sends
 * her here; this is how she gets back.
 *
 * It reuses the hand-off the rest of the app uses (utils/returnPath) and adds
 * nothing: no new utility, no lookup, no request, and the shared validation
 * is not altered. Three conditions, all required:
 *   · the event's own association is known (used_in_episode_id);
 *   · readReturn accepts the address — a path in this app naming THAT episode;
 *   · the `from` really names that episode, which this page insists on even
 *     though the shared rule would also follow a `from` naming none.
 *
 * An event reused by another episode through its brief does not match, and
 * the page is as it was. Finding that episode would need another association
 * lookup, which is deliberately not done.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT_URL = '/api/v1/world/show-1/events/ev-1';
const EP = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Velour Awards Night', event_type: 'invite',
  prestige: 6, event_date: '2026-11-09', updated_at: '2026-09-25T10:00:00.000Z',
  canon_consequences: {},
};

/** `usedInEpisode` is the event's single association, or null while unknown. */
const payload = (usedInEpisode) => ({
  success: true, event: EVENT, sourceProfile: null, startedFromProfile: null,
  sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode,
});

const open = (search, usedInEpisode) => render(
  <MemoryRouter initialEntries={[`/shows/show-1/events/ev-1${search}`]}>
    <Routes>
      <Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} />
    </Routes>
  </MemoryRouter>,
);

const origin = (episodeId, label = 'Checklist') =>
  `?from=${encodeURIComponent(`/episodes/${episodeId}?tab=checklist`)}&fromLabel=${label}`;

const loaded = () => waitFor(() => expect(screen.queryByRole('status', { name: 'Loading event' })).toBeNull(), { timeout: 4000 });
const affordance = () => screen.queryByTestId('epp-episode-return');

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  Object.values(api).forEach((fn) => fn?.mockReset?.());
});

const serve = (usedInEpisode) => {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === EVENT_URL) return { data: payload(usedInEpisode) };
    return { data: { success: true, deliverables: [], locked: false } };
  });
};

describe("the Event Package's way back", () => {
  test('no origin at all: the page is exactly as it was', async () => {
    serve({ id: EP, title: 'Gala' });
    open('', null);
    await loaded();
    expect(affordance()).toBeNull();
  });

  test('a valid origin naming the associated episode: the way back is offered', async () => {
    serve({ id: EP, title: 'Gala' });
    open(origin(EP), null);
    await waitFor(() => expect(affordance()).toBeTruthy(), { timeout: 4000 });
    expect(affordance().getAttribute('href')).toBe(`/episodes/${EP}?tab=checklist`);
    expect(affordance().textContent).toMatch(/Back to Checklist/);
  });

  test('an origin naming a DIFFERENT episode is refused', async () => {
    serve({ id: EP, title: 'Gala' });
    open(origin(OTHER), null);
    await loaded();
    expect(affordance()).toBeNull();
  });

  test('no association at all: refused, whatever the address says', async () => {
    serve(null);
    open(origin(EP), null);
    await loaded();
    expect(affordance()).toBeNull();
  });

  test('while the association is still loading nothing is offered', async () => {
    let release;
    const held = new Promise((res) => { release = res; });
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === EVENT_URL) { await held; return { data: payload({ id: EP, title: 'Gala' }) }; }
      return { data: { success: true, deliverables: [], locked: false } };
    });
    open(origin(EP), null);
    expect(affordance()).toBeNull();
    release();
    await waitFor(() => expect(affordance()).toBeTruthy(), { timeout: 4000 });
  });

  test('an origin that names NO episode keeps the existing behaviour, though the shared rule would follow it', async () => {
    serve({ id: EP, title: 'Gala' });
    open('?from=%2Fshows%2Fshow-1%2Fworld%3Ftab%3Devents&fromLabel=Events', null);
    await loaded();
    expect(affordance()).toBeNull();
  });

  test('malformed and external origins are refused', async () => {
    for (const search of [
      '?from=https%3A%2F%2Fevil.example%2Fx',
      '?from=%2F%2Fevil.example%2Fx',
      '?from=javascript%3Aalert(1)',
      '?from=%2Fepisodes%2F%E0%A4%A',
      '?from=%2Fepisodes%2F',
    ]) {
      serve({ id: EP, title: 'Gala' });
      const { unmount } = open(search, null);
      await loaded();
      expect(affordance()).toBeNull();
      unmount();
    }
  });

  test('a reused event, associated with another episode, keeps the existing behaviour', async () => {
    // The two-part special: this episode's brief names the event, but the
    // event's own used_in_episode_id names the other one. Documented limit.
    serve({ id: OTHER, title: 'Part one' });
    open(origin(EP), null);
    await loaded();
    expect(affordance()).toBeNull();
  });

  test('it makes no request of its own', async () => {
    serve({ id: EP, title: 'Gala' });
    open(origin(EP), null);
    await waitFor(() => expect(affordance()).toBeTruthy(), { timeout: 4000 });
    const asked = vi.mocked(api.get).mock.calls.map(([u]) => u);
    expect(asked.filter((u) => /return|origin/i.test(String(u)))).toEqual([]);
  });
});
