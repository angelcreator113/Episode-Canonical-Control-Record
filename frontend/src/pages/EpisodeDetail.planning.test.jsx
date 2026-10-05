/**
 * Planning (Evoni, 2026-10-03, episode creation step 2): Start Episode
 * lands on the Overview, which opens on what the episode inherited from
 * its event and the one next decision: Generate Script, then the
 * production checklist. A gap says where to finish it.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false }),
}));

// The toast object must be referentially stable across renders. EpisodeDetail's
// `fetchEpisode` useCallback lists `toast` in its deps, and the episode-loading
// effect lists `fetchEpisode` in turn — so a mock that returns a fresh object per
// call makes that effect re-fire on every render and re-enter `setLoading(true)`
// forever, leaving the component stuck on "Loading episode...". `vi.hoisted` is
// what lets the (hoisted) `vi.mock` factory close over this one instance.
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

vi.mock('../hooks/usePhonePlayback', () => ({
  default: () => ({}),
}));

vi.mock('../components/Episodes/EpisodeOverviewTab', () => ({
  default: () => <div data-testid="episode-overview">Overview body</div>,
}));

vi.mock('../components/Episodes/NextEventSuggestionsOverlay', () => ({
  default: () => null,
}));

vi.mock('../components/SceneLibraryPicker', () => ({
  default: () => null,
}));

vi.mock('../components/Episodes/EpisodeProductionChecklist', () => ({
  default: () => <div data-testid="episode-checklist">Production checklist body</div>,
}));

vi.mock('../components/Episodes/EpisodeTodoList', () => ({
  default: () => <div data-testid="episode-todo-overlays">Episode to-do overlays</div>,
}));

vi.mock('../components/Episodes/EpisodeAssetsTab', () => ({
  default: () => <div data-testid="episode-assets">Assets body</div>,
}));
vi.mock('../components/Episodes/EpisodeLalasPhoneTab', () => ({ default: () => null }));
vi.mock('../components/Episodes/EpisodeScriptTab', () => ({ default: () => <div data-testid="episode-script">Script body</div> }));
vi.mock('../components/Episodes/EpisodeDistributionTab', () => ({ default: () => null }));
vi.mock('../components/EpisodeWardrobeGameplay', () => ({ default: () => null }));
vi.mock('../components/Episodes/EpisodeScenesTab', () => ({ default: () => null }));
vi.mock('../components/PhonePreviewMode', () => ({ default: () => null }));

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

const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Velour Awards Night', host_brand: 'Velour',
  venue_location_id: 'loc-1', venue_name: 'Club Noir', scene_set_id: null,
  outfit_pieces: [], narrative_stakes: 'Her first red carpet',
  canon_consequences: { automation: { guest_profiles: [{ profile_id: 1, display_name: 'Maya Chen', featured: true }] } },
};

let brief;
function mockApi() {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episode-brief/ep-1') return { data: { data: brief } };
    if (url === '/api/v1/world/show-1/events/ev-1') {
      return { data: { success: true, event: EVENT, sourceProfile: null, sceneSet: null, venueLocation: { id: 'loc-1', name: 'Club Noir' } } };
    }
    return { data: {} };
  });
}

const renderAt = (entry) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/episodes/:episodeId" element={<EpisodeDetail />} />
      <Route path="/shows/:showId/events/:eventId" element={<div data-testid="event-package">package</div>} />
    </Routes>
  </MemoryRouter>,
);

describe('EpisodeDetail Planning card', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    brief = { episode_id: 'ep-1', event_id: 'ev-1' };
    mockApi();
  });

  test('the Overview opens on what Start Episode carried, with Generate Script next', async () => {
    renderAt('/episodes/ep-1?tab=overview');
    const card = await screen.findByTestId('episode-planning');
    expect(screen.getByTestId('episode-overview')).toBeTruthy();
    expect(within(card).getByTestId('episode-planning-count').textContent).toBe('3 of 5 carried from the event');
    expect(within(card).getByTestId('episode-planning-event').textContent).toMatch(/Velour Awards Night · organized by Velour/);
    expect(within(card).getByTestId('episode-planning-cast').textContent).toMatch(/1 featured: Maya Chen/);
    expect(within(card).getByTestId('episode-planning-location').getAttribute('data-done')).toBe('false');

    fireEvent.click(within(card).getByTestId('episode-planning-next'));
    await waitFor(() => expect(screen.getByTestId('episode-script')).toBeTruthy());
    expect(screen.queryByTestId('episode-planning')).toBeNull();
  });

  test('a missing look opens Wardrobe; a missing scene set opens the Event Package', async () => {
    renderAt('/episodes/ep-1?tab=overview');
    const card = await screen.findByTestId('episode-planning');
    expect(within(card).getByTestId('episode-planning-fix-location').getAttribute('href')).toBe('/shows/show-1/events/ev-1');

    fireEvent.click(within(card).getByTestId('episode-planning-fix-look'));
    // Production -> Wardrobe (its body waits for the episode's events).
    await waitFor(() => expect(screen.getByTitle('Production').className).toContain('ed-tab-active'));
    expect(screen.getByRole('button', { name: 'Wardrobe' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Wardrobe' }).className).toContain('is-active');
    expect(screen.queryByTestId('episode-planning')).toBeNull();
  });

  test('an episode with no source event shows no Planning card', async () => {
    brief = { episode_id: 'ep-1', event_id: null };
    renderAt('/episodes/ep-1?tab=overview');
    await screen.findByTestId('episode-overview');
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1'));
    expect(screen.queryByTestId('episode-planning')).toBeNull();
    expect(api.get).not.toHaveBeenCalledWith('/api/v1/world/show-1/events/ev-1');
  });

  test('the card is only on the Overview', async () => {
    renderAt('/episodes/ep-1?tab=checklist');
    await screen.findByTestId('episode-checklist');
    expect(screen.queryByTestId('episode-planning')).toBeNull();
  });
});
