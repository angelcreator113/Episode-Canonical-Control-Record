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
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

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

vi.mock('../services/episodeService', () => ({
  default: {
    getEpisode: vi.fn().mockResolvedValue({
      id: 'ep-1',
      title: 'Episode One',
      show_id: 'show-1',
      show: { id: 'show-1' },
    }),
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
  default: ({ event }) => <div data-testid="wardrobe-gameplay">Styling for {event?.name}</div>,
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

const renderAt = (entry) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/episodes/:episodeId" element={<EpisodeDetail />} />
    </Routes>
  </MemoryRouter>,
);

function mockApi(episodeEvents) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episodes/ep-1/events') {
      return { data: { success: true, anchor_event_id: episodeEvents[0]?.id || null, events: episodeEvents } };
    }
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
    const options = screen.getAllByRole('option').map((o) => o.textContent);
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
    expect(screen.getByText('No events linked to this episode')).toBeTruthy();
  });

  test('the events read does not run off the Wardrobe sub-tab', async () => {
    mockApi([{ id: 'ev-1', name: 'Maison Belle Gala', link: { anchor: true } }]);
    renderAt('/episodes/ep-1?tab=scripts');

    await waitFor(() => expect(screen.getAllByText('Episode One').length).toBeGreaterThan(0));
    expect(api.get).not.toHaveBeenCalledWith('/api/v1/episodes/ep-1/events');
  });
});
