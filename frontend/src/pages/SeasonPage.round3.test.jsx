/**
 * The Season page, round 3 (Evoni, 2026-10-26: "Start the Season page round
 * 3, show me first"): the health line in the hero, Story and the Overview's
 * Secrets & Reveals following the season switcher, the Cast tab, the
 * Roadmap's Calendar view (a list by week on a phone) and Print plan, with
 * the empty spots a later AI step fills.
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
const releaseRow = (over) => ({ episode_id: 'ep-s2a', episode_number: 3, season_number: 2, number: 1, title: 'Season two opener', status: 'draft', date: '2099-11-01', time: '10:00', source: 'schedule', due: 'soon', days_until: 3, ...over });

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
    if (path === '/api/v1/world/show-1/season/twists') return { data: { arc: { id: season === '1' ? 'arc-1' : 'arc-2' }, slots: [], threads: [], characters: [], twists: [], warnings: [] } };
    if (path === '/api/v1/world/show-1/season/cast') return { data: season === '1' ? state.castS1 : state.cast };
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
    cast: {
      arc: { id: 'arc-2', season_number: 2 }, season_number: 2, slots: [],
      people: [
        { key: 'c-truth', name: 'Truthville', character_id: 'c-truth', profile_id: 4, is_lala: false, slots: [2, 11], roles: { 2: 'host', 11: 'guest' } },
        { key: 'profile:9', name: 'Marcus', character_id: null, profile_id: 9, is_lala: false, slots: [2], roles: { 2: 'guest' } },
      ],
      parts: [
        { phase: 1, title: 'Foundation', episode_start: 1, episode_end: 3, changes: [{ slot_number: 2, a: { id: 'c-truth', name: 'Truthville' }, b: { id: 'c-lala', name: 'Lala' }, stage_before: 'strangers', stage_after: 'rivals', source: 'saved' }] },
        { phase: 2, title: 'Ascension', episode_start: 4, episode_end: 6, changes: [] },
      ],
    },
    castS1: { arc: { id: 'arc-1', season_number: 1 }, season_number: 1, slots: [], people: [], parts: [] },
  };
  mockGets();
});


const getUrls = () => vi.mocked(api.get).mock.calls.map((c) => c[0]);

describe('the health line', () => {
  test('in the hero: the tone chip, the part in progress, the goals behind, the next release', async () => {
    renderPage();
    const line = await screen.findByTestId('szn-health');
    expect(within(screen.getByTestId('szn-hero')).getByTestId('szn-health')).toBe(line);
    // A release within three days (Needs attention's own "soon" item): Needs attention.
    await waitFor(() => expect(within(line).getByTestId('szn-health-tone').textContent).toBe('Needs attention'));
    expect(within(line).getByTestId('szn-health-part').textContent).toMatch(/Part 1 is 2 of 3 ready/);
    expect(within(line).getByTestId('szn-health-goals').textContent).toMatch(/1 goal behind/);
    expect(within(line).getByTestId('szn-health-release').textContent).toMatch(/next release \w{3}, Nov 1/);
    // The AI's "What should I do next?" spot is there, empty.
    expect(within(line).getByTestId('szn-slot-next-step').textContent).toBe('');
  });

  test('a past season: Season complete, its own episodes, no goals', async () => {
    renderPage('?season=1');
    const line = await screen.findByTestId('szn-health');
    expect(within(line).getByTestId('szn-health-tone').textContent).toBe('Season complete');
    expect(within(line).getByTestId('szn-health-part').textContent).toMatch(/All 1 episodes done/);
    expect(within(line).queryByTestId('szn-health-goals')).toBeNull();
  });
});

describe('Story and Secrets follow the switcher', () => {
  test('a past season\'s Story reads its own threads, twists, reveal plan and needs', async () => {
    renderPage('?season=1&tab=story');
    expect(await screen.findByTestId('szn-story-season')).toBeTruthy();
    await waitFor(() => {
      const urls = getUrls();
      for (const p of ['threads', 'twists', 'reveals', 'needs']) expect(urls).toContain(`/api/v1/world/show-1/season/${p}?season=1`);
    });
    expect(screen.getByTestId('szn-past-season').textContent).toMatch(/story, cast and results are its own; Goals follow the season in progress/);
    // Suggest twists drafts for the season in progress: not offered on a past one.
    expect(screen.queryByTestId('stw-suggest')).toBeNull();
    // The AI's "Carried into Season N" spot is there, empty.
    expect(screen.getByTestId('szn-slot-story-carried').textContent).toBe('');
  });

  test('the Overview\'s Secrets & Reveals reads the season shown; the season in progress reads without ?season', async () => {
    renderPage('?season=1');
    await screen.findByTestId('szn-sum-secrets');
    await waitFor(() => expect(getUrls()).toContain('/api/v1/world/show-1/season/reveals?season=1'));
    expect(getUrls()).not.toContain('/api/v1/world/show-1/season/reveals');
  });

  test('the season in progress: Story reads as before, with Suggest twists', async () => {
    renderPage('?tab=story');
    expect(await screen.findByTestId('stw-suggest')).toBeTruthy();
    expect(getUrls()).toContain('/api/v1/world/show-1/season/threads');
    expect(getUrls().some((u) => u.includes('?season='))).toBe(false);
    expect(screen.queryByTestId('szn-slot-story-carried')).toBeNull();
  });
});

describe('the Cast tab', () => {
  test('who appears where, plainly, with the person page and the gap; what changed per part', async () => {
    renderPage('?tab=cast');
    const truth = await screen.findByTestId('szn-cast-person-c-truth');
    expect(truth.textContent).toMatch(/E2, E11/);
    expect(within(truth).getByRole('link', { name: 'Truthville' }).getAttribute('href')).toBe('/character/c-truth');
    expect(within(truth).getByTestId('szn-cast-gap-c-truth').textContent).toMatch(/Not seen E3 – E10 \(8 episodes\)/);
    // No registry character: a name, not a link.
    expect(within(screen.getByTestId('szn-cast-person-profile:9')).queryByRole('link')).toBeNull();
    expect(screen.getByTestId('szn-cast-part-1').textContent).toMatch(/Truthville and Lala: strangers to rivals/);
    expect(screen.getByTestId('szn-cast-part-2').textContent).toMatch(/No relationship change saved/);
    expect(screen.getByTestId('szn-slot-cast-suggestions').textContent).toBe('');
  });

  test('a past season reads its own cast', async () => {
    renderPage('?season=1&tab=cast');
    expect(await screen.findByTestId('szn-cast-empty')).toBeTruthy();
    expect(getUrls()).toContain('/api/v1/world/show-1/season/cast?season=1');
  });
});

describe('the Calendar view', () => {
  test('the Roadmap\'s Calendar: the month with the release on its day, a slot opens from it', async () => {
    renderPage('?tab=roadmap&view=calendar');
    const cal = await screen.findByTestId('szn-calendar');
    await waitFor(() => expect(within(cal).getByTestId('scal-month').textContent).toBe('November 2099'));
    const day = within(cal).getByTestId('scal-day-2099-11-01');
    expect(within(day).getByText('Releases E1')).toBeTruthy();
    // The phone's list by week is there too (CSS shows one or the other).
    expect(within(within(cal).getByTestId('scal-weeks')).getByText(/Week of \w{3}, Nov 1/)).toBeTruthy();
    fireEvent.click(within(day).getByRole('button', { name: /Releases E1/ }));
    expect(await screen.findByTestId('season-slot-panel')).toBeTruthy();
    fireEvent.click(within(cal).getByTestId('scal-next'));
    expect(within(cal).getByTestId('scal-month').textContent).toBe('December 2099');
  });
});

describe('Print plan', () => {
  test('the hero links the one-pager, for the season shown', async () => {
    renderPage();
    expect((await screen.findByTestId('szn-print-plan')).getAttribute('href')).toBe('/shows/show-1/season/plan');
  });
  test('a past season keeps Print plan (and only that)', async () => {
    renderPage('?season=1');
    expect((await screen.findByTestId('szn-print-plan')).getAttribute('href')).toBe('/shows/show-1/season/plan?season=1');
    expect(screen.queryByTestId('szn-edit-season')).toBeNull();
  });
});
