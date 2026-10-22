/**
 * The studio header (Evoni's mockup, 2026-10-19): the breadcrumb, the cover
 * with its EPISODE n badge, the show pill, the title, the meta row from the
 * data the page already reads, and the tab bar's chosen tab. Pieces with no
 * data are left out.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
    getEpisode: vi.fn(),
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

// Three checks, one done: the badge says 2 left; the checklist's own
// re-check reports one more done.
vi.mock('../components/Episodes/EpisodeProductionChecklist', () => ({
  CHECKLIST_SECTIONS: [{ items: [{ id: 'a' }, { id: 'b' }] }, { items: [{ id: 'c' }] }],
  loadProductionChecks: vi.fn().mockResolvedValue({ checks: { a: true } }),
  default: ({ onChecks }) => (
    <button type="button" data-testid="recheck" onClick={() => onChecks({ a: true, b: true }, [{ items: [{ id: 'a' }, { id: 'b' }] }, { items: [{ id: 'c' }] }])}>
      re-check
    </button>
  ),
}));

vi.mock('../components/Episodes/EpisodeTodoList', () => ({
  default: () => <div data-testid="episode-todo-overlays">Episode to-do overlays</div>,
}));

vi.mock('../components/Episodes/EpisodeRawFootageTab', () => ({
  default: () => <div data-testid="episode-assets">Assets body</div>,
}));
vi.mock('../components/Episodes/EpisodeLalasPhoneTab', () => ({ default: () => null }));
vi.mock('../components/Episodes/EpisodeScriptTab', () => ({ default: () => null }));
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
import episodeService from '../services/episodeService';
import EpisodeDetail, { formatShortDate } from './EpisodeDetail';

const renderAt = (entry) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/episodes/:episodeId" element={<EpisodeDetail />} />
    </Routes>
  </MemoryRouter>,
);

const FULL = {
  id: 'ep-1',
  title: 'I Designed My Outfit for a Fashion Studio Experiment',
  episode_number: 1,
  status: 'draft',
  description: 'Lala steps into the studio for an evening of independent design.',
  air_date: '2026-11-12',
  thumbnail_url: 'https://cdn.example/thumb.jpg',
  show_id: 'show-1',
  show: { id: 'show-1', name: 'Styling Adventures with Lala' },
};

describe('the studio header', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/ep-1/events') {
        return { data: { success: true, events: [{ id: 'ev-1', name: 'Studio Night', venue_name: 'Studio by Sable', show_id: 'show-1', link: { anchor: true } }] } };
      }
      return { data: {} };
    });
  });

  test('breadcrumb, cover, show pill, title, meta and description from the episode', async () => {
    vi.mocked(episodeService.getEpisode).mockResolvedValue(FULL);
    renderAt('/episodes/ep-1?tab=scripts');
    const header = await screen.findByTestId('ed-header');

    const crumbs = within(header).getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');
    expect(within(crumbs).getByRole('link', { name: 'Episodes' }).getAttribute('href')).toBe('/shows/show-1');
    expect(crumbs.querySelector('[aria-current="page"]').textContent).toBe(FULL.title);

    expect(within(header).getByRole('heading', { level: 1 }).textContent).toBe(FULL.title);
    const pill = screen.getByTestId('ed-show-pill');
    expect(pill.textContent).toBe('Styling Adventures with Lala');
    expect(pill.getAttribute('href')).toBe('/shows/show-1');

    const cover = screen.getByTestId('ed-cover');
    expect(cover.querySelector('img').getAttribute('src')).toBe(FULL.thumbnail_url);
    // The episode number once, in the meta line (Evoni, 2026-10-22 layout list).
    expect(screen.queryByTestId('ed-cover-badge')).toBeNull();

    const meta = within(header).getByRole('list', { name: 'Episode details' });
    expect(meta.textContent).toContain('Episode 1');
    expect(meta.textContent).toContain('Air date: Nov 12, 2026');
    const place = await within(meta).findByTestId('ed-source-event');
    expect(place.textContent).toContain('Studio Night');
    expect(place.textContent).toContain('Studio by Sable');
    expect(within(header).getByText(FULL.description)).toBeTruthy();
  });

  test('the chosen tab is the magenta pill; the tabs keep their names and order', async () => {
    vi.mocked(episodeService.getEpisode).mockResolvedValue(FULL);
    renderAt('/episodes/ep-1?tab=scripts');
    const bar = await screen.findByTestId('ed-tabs');
    const tabs = within(bar).getAllByRole('button');
    expect(tabs.map((b) => b.getAttribute('title'))).toEqual(['Overview', 'Script', 'Production', 'Results']);
    const active = tabs.filter((b) => b.className.includes('ed-tab-active'));
    expect(active).toHaveLength(1);
    expect(active[0].getAttribute('title')).toBe('Script');
    expect(active[0].getAttribute('aria-current')).toBe('page');
  });

  test('with no thumbnail, show name, date, description or event, those pieces are left out', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    vi.mocked(episodeService.getEpisode).mockResolvedValue({ id: 'ep-1', title: 'Bare', episode_number: 4, show_id: 'show-1', show: { id: 'show-1' } });
    renderAt('/episodes/ep-1?tab=overview');
    const header = await screen.findByTestId('ed-header');
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/events'));
    // No picture, no cover: no placeholder number (Evoni, 2026-10-22 layout list).
    expect(screen.queryByTestId('ed-cover')).toBeNull();
    expect(header.querySelector('.eds-hero').className).not.toContain('has-cover');
    expect(screen.queryByTestId('ed-show-pill')).toBeNull();
    expect(screen.queryByTestId('ed-source-event')).toBeNull();
    const meta = within(header).getByRole('list', { name: 'Episode details' });
    expect(within(meta).getAllByRole('listitem')).toHaveLength(1);
    expect(header.querySelector('.eds-description')).toBeNull();
  });

  test('dates read as a calendar day', () => {
    expect(formatShortDate('2026-11-12')).toBe('Nov 12, 2026');
    expect(formatShortDate(null)).toBe('');
    expect(formatShortDate('not a date')).toBe('');
  });
});
