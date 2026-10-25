/**
 * The Season page, what is waiting (Evoni, 2026-10-25: "I want them all and
 * show me first"): "Needs attention" at the top of the Overview (ranked,
 * each row a link, "+N more", "Nothing waiting"), the counts on the tabs,
 * the stat cards as links with a fifth for the next release, the Episodes
 * and Results tabs kept to this season with "Show all seasons", the season
 * switcher (two seasons; none for one), and ?slot=N opening a slot's panel.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import SeasonPage from './SeasonPage';

const PHASES = [
  { phase: 1, title: 'Foundation', status: 'active', episode_start: 1, episode_end: 3 },
  { phase: 2, title: 'Ascension', status: 'upcoming', episode_start: 4, episode_end: 6 },
];
const arcFor = (n, over = {}) => ({
  id: `arc-${n}`, title: `Season ${n} title`, season_number: n, status: n === 2 ? 'active' : 'completed', current_phase: 1, current_episode: 1,
  episode_end: 6, emotional_temperature: 'rising', narrative_debt: [], progression_log: [], phases: PHASES, ...over,
});
const slot = (n, over = {}) => ({
  id: `slot-${n}`, slot_number: n, phase: n <= 3 ? 1 : 2, label: `S2 · E${n}`, state: 'needs_event', locked: false,
  episode: null, event: null, intention: {}, intention_editable: true, result: {}, ...over,
});
function roadmapFor(season, slots) {
  return {
    arc: { id: `arc-${season}`, current_phase: 1 }, season_number: season, slot_count: slots.length,
    counts: { done: 0 }, phases: PHASES.map((p) => ({ ...p, slots: slots.filter((s) => s.phase === p.phase) })),
    unslotted_episodes: [], available_events: [], next_slot_number: 2, phase_boundary: null,
  };
}
// Season 2 (in progress): E1 in production, E2 an event needing setup, E3-E6 open.
const S2_SLOTS = [
  slot(1, { episode: { id: 'ep-s2a', title: 'Season two opener', status: 'draft' }, locked: true, state: 'in_production' }),
  slot(2, { event: { id: 'ev-2', name: 'Velour Gala', status: 'draft' }, state: 'event_ready' }),
  slot(3), slot(4), slot(5), slot(6),
];
const S1_SLOTS = [slot(1, { episode: { id: 'ep-s1a', title: 'Season one opener', status: 'published' }, locked: true, state: 'done', label: 'S1 · E1' })];
const EPISODES = [
  { id: 'ep-s1a', title: 'Season one opener', status: 'published', episode_number: 1, season_number: 1 },
  { id: 'ep-s1b', title: 'Season one finale', status: 'published', episode_number: 2, season_number: 1 },
  { id: 'ep-s2a', title: 'Season two opener', status: 'draft', episode_number: 3, season_number: 2 },
  { id: 'ep-s2b', title: 'Season two second', status: 'draft', episode_number: 4, season_context: { arc_id: 'arc-2', season_number: 2 } },
];
const releaseRow = (over) => ({ episode_id: 'ep-s2a', episode_number: 3, season_number: 2, number: 1, title: 'Season two opener', status: 'draft', date: '2026-11-01', time: '10:00', source: 'schedule', due: 'soon', days_until: 3, ...over });

let state;
function mockGets() {
  vi.mocked(api.get).mockImplementation(async (url) => {
    const [path, query = ''] = url.split('?');
    const season = new URLSearchParams(query).get('season');
    if (path === '/api/v1/shows/show-1') return { data: { data: { id: 'show-1', name: 'Styling Adventures with Lala' } } };
    if (path === '/api/v1/episodes') return { data: { episodes: state.episodes, total: state.episodes.length } };
    if (path === '/api/v1/world/show-1/events') return { data: { events: state.events } };
    if (path === '/api/v1/world/show-1/arc') {
      const arc = season === '1' ? state.arcs[1] : state.arcs[2];
      return { data: { arc, next_season_number: 3, seasons: state.seasons, current_arc_id: 'arc-2' } };
    }
    if (path === '/api/v1/world/show-1/goals') return { data: { goals: [] } };
    if (path === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: season === '1' ? roadmapFor(1, S1_SLOTS) : roadmapFor(2, state.s2Slots) } };
    if (path === '/api/v1/world/show-1/season/threads') return { data: { threads: [], drafts: [] } };
    if (path === '/api/v1/world/show-1/season/insights') return { data: { insights: { phases: [], health: { accepted: 0, with_range: 0, in_range: 0, without_range: 0 }, money: { season: { income: 0, spend: 0, net: 0 }, balance: 0, trend: [] } } } };
    if (path === '/api/v1/world/show-1/season/needs') return { data: { needs: [], counts: {} } };
    if (path === '/api/v1/world/show-1/season/reveals') return { data: { secrets: [], reveals: [], slots: [], warnings: [] } };
    if (path === '/api/v1/world/show-1/season/proposals') return { data: { open: null, recent: [] } };
    if (path === '/api/v1/world/show-1/season/goal-coverage') return { data: state.coverage };
    if (path === '/api/v1/world/show-1/release-schedule') return { data: { data: state.release } };
    if (path === '/api/v1/opportunities/show-1') return { data: { opportunities: state.opps } };
    return { data: {} };
  });
}

function Where() {
  const loc = useLocation();
  return <span data-testid="where">{loc.pathname}{loc.search}</span>;
}
function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/shows/show-1/season${search}`]}>
      <Routes>
        <Route path="/shows/:showId/season" element={<><SeasonPage /><Where /></>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.post).mockResolvedValue({ data: {} });
  vi.mocked(api.put).mockResolvedValue({ data: {} });
  state = {
    arcs: { 1: arcFor(1), 2: arcFor(2) },
    seasons: [{ id: 'arc-1', season_number: 1, title: 'Season 1 title', status: 'completed' }, { id: 'arc-2', season_number: 2, title: 'Season 2 title', status: 'active' }],
    s2Slots: S2_SLOTS,
    episodes: EPISODES,
    events: [{ id: 'ev-2', name: 'Velour Gala' }],
    coverage: { parts: [{ phase: 1, title: 'Foundation', gaps: [{ goal_id: 'g1', title: 'Save coins' }] }, { phase: 2, title: 'Ascension', gaps: [{ goal_id: 'g2', title: 'Earn trust' }] }] },
    release: {
      state: 'active', schedule: { day: 'sun', time: '10:00', cadence: 'weekly', first_release: '2026-10-01', platforms: ['youtube'] },
      seasons: [{ season_number: 1, state: 'active', first_release: '2026-10-01', slots: {} }, { season_number: 2, state: 'active', first_release: '2026-10-30', slots: {} }],
      episodes: [releaseRow()], slots: {},
    },
    opps: [{ id: 'o1', name: 'Maison Velour', status: 'held', beat14_episode: { id: 'ep-s2a', title: 'Season two opener' } }],
  };
  mockGets();
});

describe('Needs attention', () => {
  test('opens the Overview: ranked, the deadline first, each row a link to its fix', async () => {
    renderPage();
    const box = await screen.findByTestId('szn-attention');
    // It comes before the Season Overview card.
    expect(box.compareDocumentPosition(screen.getByTestId('szn-overview-card')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await waitFor(() => expect(within(box).getAllByRole('link').length).toBeGreaterThanOrEqual(5));
    const rows = within(box).getAllByRole('link');
    expect(rows[0].textContent).toMatch(/Episode 1 releases in 3 days and still needs: final cut, thumbnail, title & copy\./);
    expect(rows[0].getAttribute('href')).toBe('/shows/show-1/world?tab=release');
    expect(within(box).getByTestId('szn-attention-slots-1').getAttribute('href')).toBe('/shows/show-1/season?tab=roadmap&slot=3');
    expect(within(box).getByTestId('szn-attention-event-ev-2').getAttribute('href')).toBe('/shows/show-1/events/ev-2');
    expect(within(box).getByTestId('szn-attention-gap-1').getAttribute('href')).toBe('/shows/show-1/season?tab=goals');
    // Seven waiting: the seventh, the held opportunity (the least urgent), is behind "+1 more".
    expect(screen.getByTestId('szn-attention-more').textContent).toBe('+1 more');
    expect(within(box).queryByTestId('szn-attention-held-o1')).toBeNull();
    fireEvent.click(screen.getByTestId('szn-attention-more'));
    expect(within(box).getByTestId('szn-attention-held-o1').getAttribute('href')).toBe('/shows/show-1/season?tab=opportunities');
  });

  test('more than six: "+N more" shows the rest', async () => {
    state.opps = Array.from({ length: 4 }, (_, i) => ({ id: `o${i}`, name: `Brand ${i}`, status: 'held', beat14_episode: { title: 'X' } }));
    renderPage();
    const more = await screen.findByTestId('szn-attention-more');
    const box = screen.getByTestId('szn-attention');
    expect(within(box).getAllByRole('link')).toHaveLength(6);
    expect(more.textContent).toMatch(/^\+\d+ more$/);
    fireEvent.click(more);
    expect(within(box).getAllByRole('link').length).toBeGreaterThan(6);
  });

  test('a clear season says "Nothing waiting"', async () => {
    state.s2Slots = [slot(1, { episode: { id: 'ep-s2a', title: 'x' }, locked: true, state: 'done' })];
    state.coverage = { parts: [] };
    state.release = { ...state.release, episodes: [releaseRow({ due: 'later', days_until: 20 })] };
    state.opps = [];
    renderPage();
    expect((await screen.findByTestId('szn-attention-none')).textContent).toMatch(/Nothing waiting/);
    await waitFor(() => expect(screen.queryByTestId('szn-tab-badge-episodes')).toBeNull());
  });
});

describe('Counts on the tabs', () => {
  test('Events, Goals, Episodes and Opportunities carry their counts; the rest none', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('szn-tab-badge-opportunities')).toBeTruthy());
    expect(screen.getByTestId('szn-tab-badge-events').getAttribute('aria-label')).toBe('(1 needs setup)');
    expect(screen.getByTestId('szn-tab-badge-goals').getAttribute('aria-label')).toBe('(2 gaps)');
    expect(screen.getByTestId('szn-tab-badge-episodes').getAttribute('aria-label')).toBe('(1 due Sunday)');
    expect(screen.getByTestId('szn-tab-badge-opportunities').getAttribute('aria-label')).toBe('(1 held)');
    // The number shows on its own, the words beside it (hidden on a phone by the CSS).
    expect(screen.getByTestId('szn-tab-badge-goals').firstChild.textContent).toBe('2');
    expect(screen.getByTestId('szn-tab-badge-goals').querySelector('.szn-tab-badge-text').textContent).toBe('gaps');
    for (const key of ['overview', 'roadmap', 'story', 'results']) expect(screen.queryByTestId(`szn-tab-badge-${key}`)).toBeNull();
  });
});

describe('The stat cards', () => {
  test('each opens its tab, and the fifth is the next release, to the Release tab', async () => {
    renderPage();
    expect((await screen.findByTestId('szn-stat-slots')).getAttribute('href')).toBe('/shows/show-1/season?tab=roadmap');
    expect(screen.getByTestId('szn-stat-goals').getAttribute('href')).toBe('/shows/show-1/season?tab=goals');
    expect(screen.getByTestId('szn-stat-events').getAttribute('href')).toBe('/shows/show-1/season?tab=events');
    expect(screen.getByTestId('szn-stat-budget').getAttribute('href')).toBe('/shows/show-1/season?tab=results');
    const rel = screen.getByTestId('szn-stat-release');
    expect(rel.getAttribute('href')).toBe('/shows/show-1/world?tab=release');
    await waitFor(() => expect(within(rel).getByTestId('szn-next-release').textContent).toBe('Sun, Nov 1 · E1'));
    fireEvent.click(screen.getByTestId('szn-stat-goals'));
    expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season?tab=goals');
  });

  test('"Not releasing yet" when the season has no first release date', async () => {
    state.release = { ...state.release, episodes: [releaseRow({ source: 'preview', due: null })] };
    renderPage();
    expect((await screen.findByTestId('szn-next-release-none')).textContent).toBe('Not releasing yet');
  });
});

describe('Episodes and Results: this season only', () => {
  test("Episodes shows this season's episodes; Show all seasons shows every one", async () => {
    renderPage('?tab=episodes');
    expect((await screen.findByTestId('szn-scope-line')).textContent).toBe('Season 2: 2 of 4 episodes');
    await waitFor(() => expect(screen.getByTestId('seb-card-ep-s2b')).toBeTruthy());
    expect(screen.queryByTestId('seb-card-ep-s1a')).toBeNull();
    fireEvent.click(screen.getByTestId('szn-scope-all'));
    expect(screen.getByTestId('where').textContent).toContain('seasons=all');
    await waitFor(() => expect(screen.getByTestId('seb-card-ep-s1a')).toBeTruthy());
    expect(screen.getByTestId('szn-scope-line').textContent).toBe('Every season: 4 episodes');
  });

  test("Results lists this season's episodes; Show all seasons lists every one", async () => {
    renderPage('?tab=results');
    await waitFor(() => expect(screen.getByTestId('ledger-row-ep-s2a')).toBeTruthy());
    expect(screen.queryByTestId('ledger-row-ep-s1b')).toBeNull();
    fireEvent.click(screen.getByTestId('szn-scope-all'));
    await waitFor(() => expect(screen.getByTestId('ledger-row-ep-s1b')).toBeTruthy());
  });
});

describe('The season switcher', () => {
  test('two seasons: a switcher; Season 1 reads that season and hides the setup actions', async () => {
    renderPage();
    const sw = await screen.findByTestId('szn-season-switcher');
    expect(within(sw).getAllByRole('button').map((b) => b.textContent)).toEqual(['Season 1Done', 'Season 2Now']);
    expect(screen.getByTestId('szn-season-2').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('szn-edit-season')).toBeTruthy();
    fireEvent.click(screen.getByTestId('szn-season-1'));
    expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season?season=1');
    await waitFor(() => expect(screen.getByTestId('szn-past-season')).toBeTruthy());
    expect(vi.mocked(api.get).mock.calls.map(([u]) => u)).toEqual(expect.arrayContaining([
      '/api/v1/world/show-1/arc?season=1', '/api/v1/world/show-1/season/roadmap?season=1', '/api/v1/world/show-1/season/insights?season=1',
    ]));
    expect(screen.getByTestId('szn-hero').textContent).toContain('Season 1 title');
    expect(screen.queryByTestId('szn-edit-season')).toBeNull();
    expect(screen.queryByTestId('szn-overview-edit')).toBeNull();
    expect(screen.queryByTestId('szn-checklist')).toBeNull();
    // A tab link keeps the season.
    expect(screen.getByTestId('szn-stat-slots').getAttribute('href')).toBe('/shows/show-1/season?tab=roadmap&season=1');
    fireEvent.click(screen.getByTestId('szn-past-season-back'));
    expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season');
  });

  test('a past season keeps its episodes on the Episodes tab', async () => {
    renderPage('?tab=episodes&season=1');
    expect((await screen.findByTestId('szn-scope-line')).textContent).toBe('Season 1: 2 of 4 episodes');
  });

  test('a past season: the Goals card says it shows the goals now', async () => {
    renderPage('?season=1');
    await screen.findByTestId('szn-past-season');
    const goals = screen.getByTestId('szn-stat-goals');
    expect(goals.textContent).toContain('Goals now');
    expect(screen.getByTestId('szn-stat-goals-line').textContent).toMatch(/^The season in progress: /);
  });

  test("a past season's Roadmap is read-only: no advance, no new episode, a slot panel with no pencil or intention", async () => {
    state.arcs[1] = arcFor(1, { status: 'completed' });
    renderPage('?tab=roadmap&season=1&view=grid');
    expect(await screen.findByTestId('szn-roadmap-readonly')).toBeTruthy();
    expect(screen.queryByTestId('szn-add-episode')).toBeNull();
    expect(screen.queryByTestId('szn-add-episode-part-1')).toBeNull();
    fireEvent.click(within(await screen.findByTestId('szn-slot-1')).getByRole('button', { name: /^E1:/ }));
    const panel = await screen.findByTestId('season-slot-panel');
    expect(within(panel).getByTestId('season-slot-readonly')).toBeTruthy();
    expect(within(panel).queryByTestId('season-pencil-1')).toBeNull();
    expect(within(panel).queryByTestId('season-intention-1')).toBeNull();
  });

  test('the season in progress keeps its pencil and Add Episode', async () => {
    renderPage('?tab=roadmap&view=grid');
    expect(await screen.findByTestId('szn-add-episode')).toBeTruthy();
    expect(screen.queryByTestId('szn-roadmap-readonly')).toBeNull();
    fireEvent.click(within(await screen.findByTestId('szn-slot-3')).getByRole('button', { name: /^E3:/ }));
    expect(await screen.findByTestId('season-pencil-3')).toBeTruthy();
  });

  test("a past season's Events tab: one events read and one episodes read, and no pencil or placement", async () => {
    renderPage('?tab=events&show=all&season=1');
    expect(await screen.findByTestId('szn-events')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('event-card-ev-2')).toBeTruthy());
    const count = (f) => vi.mocked(api.get).mock.calls.filter(([u]) => f(u)).length;
    expect(count((u) => u === '/api/v1/world/show-1/events')).toBe(1);
    expect(count((u) => u.startsWith('/api/v1/episodes?show_id=show-1'))).toBe(1);
    expect(screen.queryByTestId('szn-events-place')).toBeNull();
    expect(screen.queryByTestId('szn-event-pencil-ev-2')).toBeNull();
  });

  test('one season: no switcher', async () => {
    state.seasons = [state.seasons[1]];
    renderPage();
    await screen.findByTestId('szn-hero');
    expect(screen.queryByTestId('szn-season-switcher')).toBeNull();
  });
});

describe('?slot=N', () => {
  test("opens that slot's panel on the Roadmap, then leaves the address", async () => {
    renderPage('?tab=roadmap&slot=3');
    const panel = await screen.findByTestId('season-slot-panel');
    await waitFor(() => expect(panel.getAttribute('aria-label')).toBe('Slot S2 · E3'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season?tab=roadmap'));
  });
});
