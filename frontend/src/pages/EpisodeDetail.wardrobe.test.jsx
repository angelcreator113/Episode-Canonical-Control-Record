/**
 * EpisodeDetail — Production → Wardrobe loads the episode's events
 * (Task #1906).
 *
 * Since #534 resolveEpTab maps `wardrobe` to activeTab 'production' /
 * sub-tab 'wardrobe', so the old `activeTab !== 'wardrobe'` gate never let
 * the events effect run and every episode showed "No events linked to this
 * episode". The effect now runs on `production.wardrobe` and reads
 * GET /api/v1/episodes/:id/events — never the show's whole event list.
 */

import { vi, describe, beforeEach, test, expect } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false }),
}));

// Referentially stable toast (see EpisodeDetail.test.jsx for why).
const { mockToast } = vi.hoisted(() => ({
  mockToast: { showError: vi.fn(), showSuccess: vi.fn() },
}));

vi.mock('../components/ToastContainer', () => ({
  useToast: () => mockToast,
}));

// Each episode id loads its own episode, so a test can move between two.
vi.mock('../services/episodeService', () => ({
  default: {
    getEpisode: vi.fn(async (id) => ({
      id,
      title: `Episode ${id}`,
      show_id: 'show-1',
      show: { id: 'show-1' },
    })),
    updateEpisode: vi.fn(),
  },
}));

vi.mock('../hooks/usePhonePlayback', () => ({ default: () => ({}) }));
vi.mock('../components/Episodes/EpisodeOverviewTab', () => ({ default: () => null }));
vi.mock('../components/Episodes/NextEventSuggestionsOverlay', () => ({ default: () => null }));
vi.mock('../components/SceneLibraryPicker', () => ({ default: () => null }));
vi.mock('../components/Episodes/EpisodeProductionChecklist', () => ({ default: () => null }));
vi.mock('../components/Episodes/EpisodeAssetsTab', () => ({ default: () => null }));
vi.mock('../components/Episodes/EpisodePhoneMissionsTab', () => ({ default: () => null }));
vi.mock('../components/Episodes/EpisodeScriptTab', () => ({ default: () => null }));
vi.mock('../components/Episodes/EpisodeDistributionTab', () => ({ default: () => null }));
vi.mock('../components/Episodes/EpisodeScenesTab', () => ({ default: () => null }));
vi.mock('../components/PhonePreviewMode', () => ({ default: () => null }));
vi.mock('../components/EpisodeWardrobeGameplay', () => ({
  default: ({ episodeId, event }) => (
    <div data-testid="wardrobe-gameplay" data-episode={episodeId} data-dress-code={event?.dress_code}>Styling for {event?.name}</div>
  ),
}));

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import api from '../services/api';
import EpisodeDetail from './EpisodeDetail';

// A test-only link that moves the mounted page to another episode, as the
// app does: the same <Route> element stays mounted, only :episodeId changes.
function GoTo({ to }) {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(to)}>go {to}</button>;
}

const renderAt = (entry, goTo = null) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/episodes/:episodeId" element={<><EpisodeDetail />{goTo && <GoTo to={goTo} />}</>} />
    </Routes>
  </MemoryRouter>,
);

const eventsReply = (events) => ({ data: { success: true, anchor_event_id: events[0]?.id || null, events } });

function mockApi(episodeEvents, others = {}) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episodes/ep-1/events') return eventsReply(episodeEvents);
    const other = url.match(/^\/api\/v1\/episodes\/([^/]+)\/events$/);
    if (other && others[other[1]]) return others[other[1]]();
    // The show's whole list — what the old code scanned. It holds the same
    // events stamped to this episode, so a scan would also "work"; the test
    // asserts it is never asked for.
    if (url === '/api/v1/world/show-1/events') {
      return { data: { events: episodeEvents.map((ev) => ({ ...ev, used_in_episode_id: 'ep-1' })) } };
    }
    if (url.startsWith('/api/v1/characters/lala/state')) return { data: { state: { coins: 100 } } };
    return { data: {} };
  });
}

describe('EpisodeDetail — Production → Wardrobe (Task #1906)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
  });

  test('?tab=wardrobe shows the episode\'s event, read from /episodes/:id/events', async () => {
    mockApi([{ id: 'ev-1', name: 'Maison Belle Gala', dress_code: 'Black tie', prestige: 8, link: { anchor: true } }]);
    renderAt('/episodes/ep-1?tab=wardrobe');

    await waitFor(() => expect(screen.getByTestId('wardrobe-gameplay').textContent).toBe('Styling for Maison Belle Gala'));
    expect(screen.queryByText('No events linked to this episode')).toBeNull();
    expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/events');
    expect(api.get).not.toHaveBeenCalledWith('/api/v1/world/show-1/events');
  });

  test('a multi-event episode offers every event in the picker, anchor selected', async () => {
    mockApi([
      { id: 'ev-1', name: 'Maison Belle Gala', dress_code: 'Black tie', prestige: 8, link: { anchor: true } },
      { id: 'ev-2', name: 'Morning Brunch', dress_code: 'Casual', prestige: 3, link: { anchor: false } },
    ]);
    renderAt('/episodes/ep-1?tab=wardrobe');

    await waitFor(() => expect(screen.getByText('STYLING FOR EVENT')).toBeTruthy());
    // The event picker's options (the header's status dropdown has its own).
    const picker = screen.getAllByRole('combobox').find((el) => el.getAttribute('data-testid') !== 'ed-status');
    const options = within(picker).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual([
      'Maison Belle Gala — Black tie (Prestige 8)',
      'Morning Brunch — Casual (Prestige 3)',
    ]);
    expect(screen.getByTestId('wardrobe-gameplay').textContent).toBe('Styling for Maison Belle Gala');
  });

  test('an episode with no events still shows the empty state', async () => {
    mockApi([]);
    renderAt('/episodes/ep-1?tab=wardrobe');

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/events'));
    // The request can be made while the page still reads "Loading episode...";
    // wait for the empty state to render rather than asserting at once.
    expect(await screen.findByText('No events linked to this episode')).toBeTruthy();
  });

  // Task #3107: the page stays mounted when it moves to another episode,
  // and the Wardrobe kept the first episode's event (selectedEvent was only
  // set while empty). Each episode styles for its own "From event".
  test('two episodes with different events show their own dress codes', async () => {
    mockApi(
      [{ id: 'ev-1', name: 'Maison Belle Gala', dress_code: 'Black tie', prestige: 8, link: { anchor: true } }],
      { 'ep-2': async () => eventsReply([{ id: 'ev-2', name: 'Morning Brunch', dress_code: 'Garden casual', prestige: 3, link: { anchor: true } }]) },
    );
    renderAt('/episodes/ep-1?tab=wardrobe', '/episodes/ep-2?tab=wardrobe');

    await waitFor(() => expect(screen.getByTestId('wardrobe-gameplay').dataset.dressCode).toBe('Black tie'));
    expect(screen.getByTestId('ed-source-event').textContent).toContain('Maison Belle Gala');

    await act(async () => { fireEvent.click(screen.getByText('go /episodes/ep-2?tab=wardrobe')); });

    await waitFor(() => expect(screen.getByTestId('wardrobe-gameplay').dataset.episode).toBe('ep-2'));
    const wardrobe = screen.getByTestId('wardrobe-gameplay');
    expect(wardrobe.dataset.dressCode).toBe('Garden casual');
    expect(wardrobe.textContent).toBe('Styling for Morning Brunch');
    // The same event the banner names under "From event".
    expect(screen.getByTestId('ed-source-event').textContent).toContain('Morning Brunch');
  });

  test('moving to an episode with no event shows the empty state, never the last episode\'s event', async () => {
    mockApi(
      [{ id: 'ev-1', name: 'Maison Belle Gala', dress_code: 'Black tie', prestige: 8, link: { anchor: true } }],
      { 'ep-2': async () => eventsReply([]) },
    );
    renderAt('/episodes/ep-1?tab=wardrobe', '/episodes/ep-2?tab=wardrobe');

    await waitFor(() => expect(screen.getByTestId('wardrobe-gameplay').dataset.dressCode).toBe('Black tie'));
    await act(async () => { fireEvent.click(screen.getByText('go /episodes/ep-2?tab=wardrobe')); });

    expect(await screen.findByText('No events linked to this episode')).toBeTruthy();
    expect(screen.queryByTestId('wardrobe-gameplay')).toBeNull();
    expect(screen.queryByTestId('ed-source-event')).toBeNull();
  });

  test('a failed read of the next episode\'s events says so, and keeps no event', async () => {
    mockApi(
      [{ id: 'ev-1', name: 'Maison Belle Gala', dress_code: 'Black tie', prestige: 8, link: { anchor: true } }],
      { 'ep-2': async () => { throw new Error('network'); } },
    );
    renderAt('/episodes/ep-1?tab=wardrobe', '/episodes/ep-2?tab=wardrobe');

    await waitFor(() => expect(screen.getByTestId('wardrobe-gameplay').dataset.dressCode).toBe('Black tie'));
    await act(async () => { fireEvent.click(screen.getByText('go /episodes/ep-2?tab=wardrobe')); });

    expect(await screen.findByText("Could not load this episode's event")).toBeTruthy();
    expect(screen.queryByTestId('wardrobe-gameplay')).toBeNull();
  });

  // Task #2356: the header now reads /episodes/:id/events once on every
  // tab for its "From event" link. The Wardrobe effect's own work (its
  // second events read and Lala's character state) still stays off.
  test('the Wardrobe reads do not run off the Wardrobe sub-tab', async () => {
    mockApi([{ id: 'ev-1', name: 'Maison Belle Gala', link: { anchor: true } }]);
    renderAt('/episodes/ep-1?tab=scripts');

    await waitFor(() => expect(screen.getByTestId('ed-source-event')).toBeTruthy());
    const eventsReads = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/api/v1/episodes/ep-1/events');
    expect(eventsReads).toHaveLength(1);
    expect(vi.mocked(api.get).mock.calls.some(([url]) => url.startsWith('/api/v1/characters/lala/state'))).toBe(false);
    expect(screen.queryByText('STYLING FOR EVENT')).toBeNull();
  });
});
