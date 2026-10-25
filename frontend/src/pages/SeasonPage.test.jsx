/**
 * The Season page (Evoni's mockup, 2026-10-25): the tabs and `?tab=`, the
 * hero with and without a cover, the stat cards (the budget from the ledger,
 * or saying there is none), the roadmap's views and filters, a card opening
 * the Season Plan's slot panel, the advance bar's rule, the Edit season
 * form's new fields, the summary cards, the way back to Producer Mode, and
 * the Goals tab (Career Goals and the brands, moved here from Producer
 * Mode's retired Season Plan tab, 2026-10-25).
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
  { phase: 1, title: 'Foundation', tagline: 'Identity, confidence, and first big opportunities.', status: 'active', episode_start: 1, episode_end: 8,
    emotional_arc: 'curiosity → first stumble → finding her footing', picture_url: 'https://cdn.example.com/part1.jpg' },
  { phase: 2, title: 'Ascension', tagline: 'Bigger brands, higher stakes.', status: 'upcoming', episode_start: 9, episode_end: 16 },
  { phase: 3, title: 'Legacy', tagline: 'Impact and a lasting place.', status: 'upcoming', episode_start: 17, episode_end: 24 },
];
const ARC = {
  id: 'arc-1', title: 'Soft Luxury Ascension', tagline: 'Lala earns her place in the luxury tier.', season_number: 1, status: 'active',
  current_phase: 1, current_episode: 1, episode_end: 24, emotional_temperature: 'rising', narrative_debt: [], progression_log: [],
  logline: 'Lala earns her place in the luxury tier.', description: 'From bold fits to bigger opportunities.',
  starts_on: '2026-01-05', ends_on: '2026-03-29', cover_url: 'https://cdn.example.com/cover.jpg', phases: PHASES,
};
const EVENT_NAMES = { 2: 'Local Boutique "Style Challenge"', 3: 'Brand Creative Director Meeting', 4: 'Fit Check with Stable', 10: 'Fashion Mystery Box' };

function slot(n, { doneUpto = 0 } = {}) {
  const done = n <= doneUpto;
  const producing = !done && n === doneUpto + 1 && n === 1;
  const eventName = EVENT_NAMES[n] || null;
  const state = done ? 'done' : producing ? 'in_production' : eventName ? 'event_ready' : 'needs_event';
  return {
    id: `slot-${n}`, slot_number: n, phase: n <= 8 ? 1 : n <= 16 ? 2 : 3, label: `S1 · E${n}`, state,
    locked: done || producing,
    episode: done || producing ? { id: `ep-${n}`, title: producing ? 'I Designed My Outfit' : `Made ${n}`, status: 'draft', evaluation_status: done ? 'accepted' : null } : null,
    event: eventName ? { id: `ev-${n}`, name: eventName, status: 'ready' } : null,
    intention: {}, intention_editable: !done, result: {},
  };
}
function roadmapFor({ doneUpto = 0 } = {}) {
  const slots = Array.from({ length: 24 }, (_, i) => slot(i + 1, { doneUpto }));
  const counts = slots.reduce((acc, s) => ({ ...acc, [s.state]: (acc[s.state] || 0) + 1 }), { done: 0, in_production: 0, event_ready: 0, needs_event: 0 });
  return {
    arc: { id: 'arc-1', title: ARC.title, current_phase: 1 }, season_number: 1, slot_count: 24, counts,
    phases: PHASES.map((p) => ({ ...p, slots: slots.filter((s) => s.phase === p.phase) })),
    unslotted_episodes: [], available_events: [{ id: 'ev-free', name: 'Midnight Atelier: Dark Couture Preview', status: 'draft' }],
    next_slot_number: doneUpto + 2, phase_boundary: null,
  };
}
const INSIGHTS = {
  phases: [], health: { accepted: 0, with_range: 0, in_range: 0, without_range: 0 },
  money: {
    season: { income: 0, spend: 1132, net: -1132 }, balance: 768,
    trend: [{ balance_after: 1900, between_episodes: false }, { balance_after: 1200, between_episodes: true }, { balance_after: 768, between_episodes: false }],
  },
};

let state;
function mockGets() {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/shows/show-1') return { data: { data: { id: 'show-1', name: 'Styling Adventures with Lala' } } };
    if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { episodes: state.episodes, total: state.episodes.length } };
    if (url === '/api/v1/world/show-1/events') return { data: { events: state.events } };
    if (url === '/api/v1/world/show-1/arc') return { data: { arc: state.arc, next_season_number: 2 } };
    if (url === '/api/v1/world/show-1/goals') return { data: { goals: state.goals } };
    if (url === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: state.roadmap } };
    if (url === '/api/v1/world/show-1/season/threads') return { data: { threads: state.threads, drafts: [] } };
    if (url === '/api/v1/world/show-1/season/insights') {
      if (state.insightsFail) throw Object.assign(new Error('x'), { response: { data: { error: 'down' } } });
      return { data: { insights: state.insights } };
    }
    if (url === '/api/v1/world/show-1/season/needs') return { data: { needs: [], counts: {} } };
    if (url === '/api/v1/world/show-1/season/reveals') return { data: state.reveals };
    if (url === '/api/v1/world/show-1/season/twists') return { data: { arc: { id: 'arc-1' }, slots: [], threads: [], characters: [], twists: [], warnings: [] } };
    if (url === '/api/v1/world/show-1/season/proposals') return { data: { open: null, recent: [] } };
    if (url === '/api/v1/shows/show-1/career-list') return { data: { data: state.careerList } };
    if (url === '/api/v1/opportunities/show-1') return { data: { opportunities: state.opps || [] } };
    if (url.startsWith('/api/v1/world/show-1/suggest-events')) return { data: { success: true, suggestions: state.suggestions } };
    if (url.startsWith('/api/v1/assets')) return { data: { data: [{ id: 'a1', name: 'Rooftop dusk', media_type: 'image', s3_url_processed: 'https://cdn.example.com/rooftop.jpg' }] } };
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
  vi.mocked(api.put).mockResolvedValue({ data: { success: true, moved: 0 } });
  state = {
    arc: ARC, roadmap: roadmapFor(), insights: INSIGHTS, insightsFail: false,
    episodes: [{ id: 'ep-1', title: 'I Designed My Outfit', status: 'draft', thumbnail_url: 'https://cdn.example.com/ep1.jpg' }],
    events: [{ id: 'ev-2', name: EVENT_NAMES[2], event_type: 'invite', event_date: '2026-01-19', invitation_url: 'https://cdn.example.com/ev2.jpg' }],
    goals: [
      { id: 'g1', title: 'Grow audience to 100K', status: 'active' }, { id: 'g2', title: 'Land 3 brand deals', status: 'completed' },
      { id: 'g3', title: 'Be featured in a magazine', status: 'paused' }, { id: 'g4', title: 'Missed one', status: 'failed' },
    ],
    threads: [{ id: 't1', title: "Lala's Confidence Journey", status: 'open', slot_numbers: [1, 2, 3, 4, 5, 6] }],
    careerList: { brands: [{ name: 'Maison Velour', episodes: [{ number: 3 }] }], hidden_brands: [] },
    suggestions: [],
    reveals: {
      arc: { id: 'arc-1' }, slots: [], warnings: [],
      secrets: [{ id: 's1', text: 'Identity Change', state: 'hidden', character_name: 'Lala' }, { id: 's2', text: 'Unplanned', state: 'hidden', character_name: 'Lala' }],
      reveals: [
        { id: 'r1', secret_id: 's1', slot_number: 4, intent: 'hint' }, { id: 'r2', secret_id: 's1', slot_number: 9, intent: 'hint' },
        { id: 'r3', secret_id: 's1', slot_number: 20, intent: 'reveal' },
      ],
    },
  };
  mockGets();
});

describe('The tabs', () => {
  test('Overview by default; each tab is addressed by ?tab= and a click moves the address', async () => {
    renderPage();
    expect(await screen.findByTestId('szn-panel-overview')).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    // Evoni, 2026-10-25: Producer Mode's episodes, opportunities and results moved here.
    expect(tabs.map((t) => t.textContent)).toEqual(['Overview', 'Roadmap', 'Episodes', 'Events', 'Opportunities', 'Story', 'Goals', 'Results']);
    expect(screen.getByTestId('szn-tab-overview').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByTestId('szn-tab-story'));
    expect(await screen.findByTestId('szn-panel-story')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season?tab=story');
    expect(await screen.findByTestId('story-threads')).toBeTruthy();
  });

  test.each([
    ['roadmap', 'szn-roadmap'], ['episodes', 'show-episodes-board'], ['events', 'szn-events'], ['opportunities', 'opp-tab'],
    ['goals', 'career-goals'], ['results', 'szn-ledger'], ['nonsense', 'szn-overview-card'],
    // The old Production Plan tab's address opens Episodes, the board it linked to.
    ['production', 'show-episodes-board'],
  ])(
    '?tab=%s opens its tab', async (tab, testId) => {
      renderPage(`?tab=${tab}`);
      expect(await screen.findByTestId(testId)).toBeTruthy();
    });

  test('every tab opens on a one-line note of what it is for', async () => {
    renderPage();
    await screen.findByTestId('szn-panel-overview');
    const notes = {};
    for (const t of screen.getAllByRole('tab')) {
      fireEvent.click(t);
      const key = t.getAttribute('data-testid').replace('szn-tab-', '');
      const note = await within(await screen.findByTestId(`szn-panel-${key}`)).findByTestId('szn-tab-note');
      notes[key] = note.textContent;
    }
    expect(Object.keys(notes)).toEqual(['overview', 'roadmap', 'episodes', 'events', 'opportunities', 'story', 'goals', 'results']);
    expect(notes.episodes).toBe('Every episode this season and where it is in production.');
    for (const text of Object.values(notes)) expect(text.length).toBeGreaterThan(20);
  });
});

describe('The hero', () => {
  test('with a cover: the picture, "Season 1", the title, the tagline and the chips', async () => {
    renderPage();
    const hero = await screen.findByTestId('szn-hero');
    expect(hero.className).toContain('has-cover');
    expect(hero.style.backgroundImage).toContain('https://cdn.example.com/cover.jpg');
    expect(within(hero).getByText('Season 1')).toBeTruthy();
    expect(within(hero).getByRole('heading', { level: 1 }).textContent).toBe('Soft Luxury Ascension');
    expect(within(hero).getByText('Styling Adventures with Lala')).toBeTruthy();
    expect(within(hero).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['24 Episodes', '3 Parts', 'Jan 5, 2026 – Mar 29, 2026']);
  });

  test('with no cover: the gradient, no picture', async () => {
    state.arc = { ...ARC, cover_url: null, starts_on: null, ends_on: null };
    renderPage();
    const hero = await screen.findByTestId('szn-hero');
    expect(hero.className).not.toContain('has-cover');
    expect(hero.style.backgroundImage).toBe('');
    expect(within(hero).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['24 Episodes', '3 Parts']);
  });

  test('the ⋯ menu: Use events and episodes, Draft with AI, and Start next season only once complete', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('szn-hero-more'));
    const menu = screen.getByTestId('szn-hero-menu');
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((b) => b.textContent)).toEqual(['Use events and episodes', 'Draft with AI', 'Start Season 2 (when this one is complete)']);
    expect(items[2].disabled).toBe(true);
    fireEvent.click(items[0]);
    expect(await screen.findByTestId('season-placement')).toBeTruthy();
  });
});

describe('The stat cards', () => {
  test('slots, goals and events from the roadmap and goals', async () => {
    state.roadmap = roadmapFor({ doneUpto: 2 });
    renderPage();
    const slots = await screen.findByTestId('szn-stat-slots');
    expect(slots.textContent).toContain('24');
    expect(slots.textContent).toContain('2 completed · 22 remaining');
    // A missed goal is not counted as remaining.
    expect(screen.getByTestId('szn-stat-goals').textContent).toContain('1 complete · 2 remaining');
    // Scheduled: a slot with an event pencilled or an episode placed (E1, E2 done; E3, E4, E10 pencilled).
    expect(screen.getByTestId('szn-stat-events').textContent).toContain('5 scheduled · 19 remaining');
  });

  test("the budget: Lala's balance and the season's spend, income and net from the ledger, with the trend", async () => {
    renderPage();
    const card = await screen.findByTestId('szn-stat-budget');
    expect(within(card).getByTestId('szn-budget-balance').textContent).toBe('768 balance');
    expect(within(card).getByTestId('szn-budget-season').textContent).toBe('This season: 1,132 spend · 0 income · −1,132 net');
    expect(within(card).getByTestId('szn-budget-trend').querySelector('svg')).toBeTruthy();
  });

  test('no ledger rows: says so, and invents no number', async () => {
    state.insights = { ...INSIGHTS, money: { season: { income: 0, spend: 0, net: 0 }, balance: null, trend: [] } };
    renderPage();
    const card = await screen.findByTestId('szn-stat-budget');
    expect(within(card).getByTestId('szn-budget-empty').textContent).toBe('No ledger rows yet: nothing earned or spent.');
    expect(within(card).queryByTestId('szn-budget-balance')).toBeNull();
    expect(within(card).queryByTestId('szn-budget-season')).toBeNull();
  });

  test('the ledger could not be read: says so', async () => {
    state.insightsFail = true;
    renderPage();
    expect((await screen.findByTestId('szn-budget-missing')).textContent).toBe('The ledger could not be read.');
  });
});

describe('The Episode Roadmap', () => {
  test('Grid: three part columns of cards, each card with its picture, E#, title and status', async () => {
    renderPage('?tab=roadmap');
    const grid = await screen.findByTestId('szn-roadmap-grid');
    expect(within(grid).getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Part 1: Foundation', 'Part 2: Ascension', 'Part 3: Legacy']);
    const e1 = screen.getByTestId('szn-slot-1');
    expect(e1.textContent).toContain('I Designed My Outfit');
    expect(e1.textContent).toContain('In Production');
    // The episode's thumbnail first; else the event's cover; else the part's picture; else a gradient.
    expect(e1.querySelector('img').getAttribute('src')).toBe('https://cdn.example.com/ep1.jpg');
    expect(screen.getByTestId('szn-slot-2').querySelector('img').getAttribute('src')).toBe('https://cdn.example.com/ev2.jpg');
    expect(screen.getByTestId('szn-slot-2').textContent).toContain('Event Pending');
    expect(screen.getByTestId('szn-slot-5').querySelector('img').getAttribute('src')).toBe('https://cdn.example.com/part1.jpg');
    expect(screen.getByTestId('szn-slot-12').querySelector('img')).toBeNull();
    expect(screen.getByTestId('szn-slot-12').textContent).toContain('Open');
    expect(screen.getByTestId('szn-add-episode-part-3').textContent).toBe(' Add Episode to Part 3');
  });

  test('the filters: one part, one status, and the address holds them', async () => {
    renderPage('?tab=roadmap');
    fireEvent.change(await screen.findByTestId('szn-filter-part'), { target: { value: '2' } });
    await waitFor(() => expect(screen.queryByTestId('szn-part-col-1')).toBeNull());
    expect(screen.getByTestId('szn-part-col-2')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season?tab=roadmap&view=grid&part=2');
    fireEvent.change(screen.getByTestId('szn-filter-status'), { target: { value: 'event_ready' } });
    await waitFor(() => expect(screen.queryByTestId('szn-slot-9')).toBeNull());
    expect(screen.getByTestId('szn-slot-10')).toBeTruthy();
  });

  test('Timeline: every slot in order, filtered the same way; no Calendar view', async () => {
    renderPage('?tab=roadmap&view=timeline&status=event_ready');
    const tl = await screen.findByTestId('szn-roadmap-timeline');
    expect([...tl.querySelectorAll('[data-testid^="szn-slot-"]')].map((el) => el.dataset.testid).filter((id) => /^szn-slot-\d+$/.test(id)))
      .toEqual(['szn-slot-2', 'szn-slot-3', 'szn-slot-4', 'szn-slot-10']);
    expect(within(tl).getByText(/Part 1 · Foundation · Jan 19, 2026/)).toBeTruthy();
    expect(screen.queryByText('Calendar')).toBeNull();
    fireEvent.click(screen.getByTestId('szn-view-grid'));
    expect(await screen.findByTestId('szn-roadmap-grid')).toBeTruthy();
  });

  test('a card opens the Season Plan slot panel, in its drawer; × closes it', async () => {
    renderPage('?tab=roadmap');
    fireEvent.click(within(await screen.findByTestId('szn-slot-3')).getByRole('button', { name: /^E3:/ }));
    const panel = await screen.findByTestId('season-slot-panel');
    expect(panel.getAttribute('aria-label')).toBe('Slot S1 · E3');
    expect(within(panel).getByRole('heading', { level: 3 }).textContent).toBe('Brand Creative Director Meeting');
    expect(panel.closest('.wa-arc-side').className).toContain('is-sheet-open');
    fireEvent.click(within(panel).getByLabelText('Close'));
    expect(screen.getByTestId('season-slot-panel').closest('.wa-arc-side').className).not.toContain('is-sheet-open');
  });

  test("a card's ⋯ opens the slot or its intention", async () => {
    renderPage('?tab=roadmap');
    fireEvent.click(await screen.findByTestId('szn-slot-menu-5'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit intention' }));
    expect(await screen.findByTestId('season-intention-editor')).toBeTruthy();
  });

  test('+ Add Episode takes the new-episode flow', async () => {
    renderPage('?tab=roadmap');
    fireEvent.click(await screen.findByTestId('szn-add-episode'));
    expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/new-episode');
  });

  // "Only show it once a slot is done" (Evoni, 2026-10-25).
  test('no slot of the current part done: no advance bar', async () => {
    renderPage('?tab=roadmap');
    await screen.findByTestId('szn-roadmap-grid');
    expect(screen.queryByTestId('season-advance-open')).toBeNull();
  });

  test('one slot done: "Advance with 7 open slots", through the server\'s confirm step', async () => {
    state.roadmap = roadmapFor({ doneUpto: 1 });
    vi.mocked(api.post).mockResolvedValue({ data: { data: { needs_confirmation: true, open_slots: [], unmet_goals: [], current_phase: { phase: 1 }, next_phase: { phase: 2, title: 'Ascension' } } } });
    renderPage('?tab=roadmap');
    const btn = await screen.findByTestId('season-advance-open-btn');
    expect(btn.textContent).toBe('Advance with 7 open slots');
    fireEvent.click(btn);
    expect(await screen.findByTestId('season-phase-confirm')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/arc/advance');
    expect(api.post).not.toHaveBeenCalledWith('/api/v1/world/show-1/arc/advance/confirm');
  });
});

describe('Edit season', () => {
  test('opens the form with the new fields, and saves them through PUT .../arc/setup', async () => {
    state.arc = { ...ARC, cover_url: null };
    renderPage();
    fireEvent.click(await screen.findByTestId('szn-edit-season'));
    const form = await screen.findByTestId('season-setup-form');
    expect(within(form).getByTestId('sst-logline').value).toBe('Lala earns her place in the luxury tier.');
    expect(within(form).getByTestId('sst-starts-on').value).toBe('2026-01-05');
    fireEvent.change(within(form).getByTestId('sst-ends-on'), { target: { value: '2026-04-05' } });
    fireEvent.click(within(form).getByTestId('sst-picture-open-Cover'));
    fireEvent.click(await within(form).findByLabelText('Use Rooftop dusk for the cover'));
    fireEvent.click(within(form).getByTestId('sst-submit'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/arc/setup', expect.objectContaining({
      title: 'Soft Luxury Ascension', logline: 'Lala earns her place in the luxury tier.', description: 'From bold fits to bigger opportunities.',
      starts_on: '2026-01-05', ends_on: '2026-04-05', cover_url: 'https://cdn.example.com/rooftop.jpg',
      phases: expect.arrayContaining([expect.objectContaining({ title: 'Foundation', picture_url: 'https://cdn.example.com/part1.jpg' })]),
    })));
    expect((await screen.findByTestId('szn-setup-note')).textContent).toBe('Season saved.');
  });

  test("the Overview card's Edit opens the same form", async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('szn-overview-edit'));
    expect(await screen.findByTestId('season-setup-form')).toBeTruthy();
  });
});

describe('The Overview', () => {
  test('the season card: logline, dates, status from the current part, Ep x of 24, description', async () => {
    renderPage();
    const card = await screen.findByTestId('szn-overview-card');
    expect(card.textContent).toContain('Season 1: Soft Luxury Ascension');
    expect(card.textContent).toContain('Jan 5, 2026 – Mar 29, 2026');
    expect(within(card).getByTestId('szn-temp').textContent).toBe('Rising');
    expect(within(card).getByTestId('szn-current-arc').textContent).toBe('Part 1: curiosity → first stumble → finding her footing');
    expect(card.textContent).toContain('Ep 1 of 24');
    expect(within(card).getByTestId('szn-description').textContent).toBe('From bold fits to bigger opportunities.');
  });

  test('a part opens itself in the roadmap', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('szn-part-open-2'));
    expect(await screen.findByTestId('szn-part-col-2')).toBeTruthy();
    expect(screen.queryByTestId('szn-part-col-1')).toBeNull();
    expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season?tab=roadmap&part=2&view=grid');
  });

  test('the checklist, the fold, and the four summary cards', async () => {
    renderPage();
    expect(await screen.findByTestId('season-checklist')).toBeTruthy();
    expect(screen.getByTestId('szn-fold-proposals').tagName).toBe('DETAILS');
    const events = screen.getByTestId('szn-sum-events');
    expect(within(events).getByText('Local Boutique "Style Challenge"')).toBeTruthy();
    expect(within(events).getByText('E2 · Jan 19, 2026')).toBeTruthy();
    expect(within(screen.getByTestId('szn-sum-threads')).getByText('6 episodes')).toBeTruthy();
    const matrix = await screen.findByTestId('szn-reveal-matrix');
    const row = within(matrix).getByText('Identity Change').closest('tr');
    expect([...row.querySelectorAll('.szn-pill')].map((p) => p.textContent)).toEqual(['E4', 'E9', 'E20']);
    // A secret with nothing planned is not a row.
    expect(within(matrix).queryByText('Unplanned')).toBeNull();
    expect(within(screen.getByTestId('szn-sum-goals')).getByText('Grow audience to 100K')).toBeTruthy();
    fireEvent.click(within(events).getByText('See all'));
    expect(await screen.findByTestId('szn-events')).toBeTruthy();
  });

  test('Season Goals: See all and Add Goal open the Goals tab (no longer Producer Mode)', async () => {
    renderPage();
    const goals = await screen.findByTestId('szn-sum-goals');
    expect(within(goals).queryByRole('link')).toBeNull();
    fireEvent.click(within(goals).getByRole('button', { name: 'See all' }));
    expect(await screen.findByTestId('career-goals')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season?tab=goals');
    fireEvent.click(screen.getByTestId('szn-tab-overview'));
    fireEvent.click(await screen.findByTestId('szn-add-goal'));
    expect(await screen.findByTestId('career-goals')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season?tab=goals');
  });
});

describe('Events, Episodes, Opportunities, Results', () => {
  test('Events: the slots\' events and the free ones, pencilled through the slot rules', async () => {
    renderPage('?tab=events');
    expect(await screen.findByTestId('szn-event-slot-2')).toBeTruthy();
    const free = screen.getByTestId('szn-event-free-ev-free');
    fireEvent.change(within(free).getByRole('combobox'), { target: { value: 'slot-5' } });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/season/slots/slot-5/event', { event_id: 'ev-free' }));
  });

  // The production board, moved from Producer Mode's Episodes › Production (2026-10-25).
  test('Episodes: the production board with the show\'s episodes', async () => {
    renderPage('?tab=episodes');
    const board = await screen.findByTestId('show-episodes-board');
    await waitFor(() => expect(within(board).getAllByText('I Designed My Outfit').length).toBeGreaterThan(0));
    expect(within(board).getByTestId('seb-count').textContent).toContain('1 episode');
  });

  // Moved from Producer Mode's Opportunities tab; a need's "Add a deal" opens its form with the company.
  test('Opportunities: the offers and bookings, and ?deal_with= opens the form for that company', async () => {
    state.opps = [{ id: 'o1', name: 'Velour Cover', status: 'negotiating', opportunity_type: 'editorial', status_history: [] }];
    renderPage('?tab=opportunities&deal_with=Maison%20Velour');
    const tab = await screen.findByTestId('opp-tab');
    expect(await within(tab).findByText('Velour Cover')).toBeTruthy();
    expect(within(tab).getByDisplayValue('Maison Velour')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/opportunities/show-1');
  });

  // One Results tab: the Episode Ledger (Producer Mode's Episodes › Results), then Planning Insights.
  test('Results: the Episode Ledger first, then Planning Insights', async () => {
    state.episodes = [{ id: 'ep-1', episode_number: 1, title: 'I Designed My Outfit', status: 'published', evaluation_status: 'accepted', evaluation_json: { tier_final: 'slay', score: 91 } }];
    renderPage('?tab=results');
    const ledger = await screen.findByTestId('szn-ledger');
    expect(within(ledger).getByRole('heading', { name: 'Episode results' })).toBeTruthy();
    expect(await within(ledger).findByText('I Designed My Outfit')).toBeTruthy();
    expect(await within(ledger).findByTestId('ledger-summary')).toBeTruthy();
    const insights = await screen.findByTestId('planning-insights');
    expect(ledger.compareDocumentPosition(insights) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/shows/show-1/financial-summary');
    expect(screen.queryByTestId('szn-open-results')).toBeNull();
  });

  // A show with no season keeps its board, opportunities and ledger (the old Producer Mode links land here).
  test('with no season: the setup, and the Episodes, Opportunities and Results tabs', async () => {
    state.arc = null;
    renderPage('?tab=episodes');
    expect(await screen.findByTestId('show-episodes-board')).toBeTruthy();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Set up the season', 'Episodes', 'Opportunities', 'Results']);
    fireEvent.click(screen.getByTestId('szn-tab-overview'));
    expect(await screen.findByTestId('szn-empty')).toBeTruthy();
    fireEvent.click(screen.getByTestId('szn-tab-results'));
    expect(await screen.findByTestId('szn-ledger')).toBeTruthy();
    expect(screen.queryByText('Planning Insights did not load.')).toBeNull();
  });
});

describe('The way back', () => {
  test('"Producer Mode" goes to its Overview, not the retired Season Plan tab', async () => {
    renderPage();
    const back = await screen.findByTestId('szn-back');
    expect(back.textContent.trim()).toBe('Producer Mode');
    expect(back.getAttribute('href')).toBe('/shows/show-1/world?tab=overview');
  });
});

describe('The Goals tab', () => {
  const GOALS = [
    { id: 'g1', title: 'Break Into Luxury Fashion', type: 'primary', status: 'active', target_metric: 'reputation', current_value: 4, target_value: 10, starting_value: 0, icon: '🌟', color: '' },
    { id: 'g2', title: 'Land 3 brand deals', type: 'secondary', status: 'active', target_metric: 'coins', current_value: 500, target_value: 1000, icon: '🤝' },
    { id: 'g3', title: 'First runway', type: 'secondary', status: 'completed', completed_at: '2026-01-20T12:00:00Z', icon: '👠' },
  ];
  beforeEach(() => { state.goals = GOALS.map((g) => ({ ...g })); });

  test('the goals by type with their progress, the completed ones, and the brands she has worked with', async () => {
    renderPage('?tab=goals');
    const tab = await screen.findByTestId('szn-goals');
    expect(within(tab).getByTestId('cg-counts').textContent).toBe('2 active · 1 complete');
    const primary = within(tab).getByTestId('cg-type-primary');
    expect(within(primary).getByText('Break Into Luxury Fashion')).toBeTruthy();
    expect(within(primary).getByRole('progressbar', { name: 'Break Into Luxury Fashion progress' }).getAttribute('aria-valuenow')).toBe('40');
    expect(within(primary).getByText('40% · 6 to go')).toBeTruthy();
    expect(within(within(tab).getByTestId('cg-type-secondary')).getByText('Land 3 brand deals')).toBeTruthy();
    // No passive goal: no empty passive section.
    expect(within(tab).queryByTestId('cg-type-passive')).toBeNull();
    expect(within(within(tab).getByTestId('cg-completed')).getByText('First runway')).toBeTruthy();
    // Seed 24 goals only before there are any.
    expect(within(tab).queryByTestId('cg-seed')).toBeNull();
    const brands = await within(tab).findByTestId('career-brands');
    expect(within(brands).getByText('Maison Velour')).toBeTruthy();
    expect(within(brands).getByText('Episode 3')).toBeTruthy();
  });

  test('a brand can be hidden from her Career list, from the Goals tab', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    renderPage('?tab=goals');
    const brands = await screen.findByTestId('career-brands');
    fireEvent.click(await within(brands).findByRole('button', { name: 'Hide Maison Velour' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/shows/show-1/career-list/hidden-brands', { brands: ['Maison Velour'] }));
  });

  test('New Goal creates one; the list, the counts and the stat card reload', async () => {
    vi.mocked(api.post).mockImplementation(async (url, body) => {
      if (url === '/api/v1/world/show-1/goals') {
        state.goals = [...state.goals, { id: 'g9', status: 'active', current_value: 0, ...body }];
        return { data: { success: true, goal: { id: 'g9', ...body } } };
      }
      return { data: {} };
    });
    renderPage('?tab=goals');
    expect((await screen.findByTestId('szn-stat-goals')).textContent).toContain('1 complete · 2 remaining');
    fireEvent.click(await screen.findByTestId('cg-new'));
    const editor = screen.getByTestId('cg-editor');
    expect(within(editor).getByTestId('cg-save').disabled).toBe(true);
    fireEvent.change(within(editor).getByTestId('cg-title'), { target: { value: 'Front row at Fashion Week' } });
    fireEvent.change(within(editor).getByTestId('cg-type'), { target: { value: 'passive' } });
    fireEvent.change(within(editor).getByTestId('cg-metric'), { target: { value: 'influence' } });
    fireEvent.change(within(editor).getByTestId('cg-target'), { target: { value: '25' } });
    fireEvent.click(within(editor).getByTestId('cg-save'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/goals', {
      title: 'Front row at Fashion Week', type: 'passive', target_metric: 'influence', target_value: 25, icon: '🎯', color: '', description: '',
    }));
    expect(await screen.findByTestId('cg-type-passive')).toBeTruthy();
    expect(screen.getByTestId('cg-note').textContent).toBe('Goal created.');
    expect(screen.queryByTestId('cg-editor')).toBeNull();
    expect(screen.getByTestId('cg-counts').textContent).toBe('3 active · 1 complete');
    expect(screen.getByTestId('szn-stat-goals').textContent).toContain('1 complete · 3 remaining');
  });

  test('a goal edits in place through PUT; a refusal says so in the page', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: { success: true, goal: {} } })
      .mockRejectedValueOnce(Object.assign(new Error('x'), { response: { data: { error: 'Only 1 primary goal' } } }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderPage('?tab=goals');
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Land 3 brand deals' }));
    const editor = screen.getByTestId('cg-editor');
    expect(within(editor).getByTestId('cg-title').value).toBe('Land 3 brand deals');
    fireEvent.change(within(editor).getByTestId('cg-target'), { target: { value: '1500' } });
    fireEvent.click(within(editor).getByTestId('cg-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/goals/g2', expect.objectContaining({ title: 'Land 3 brand deals', target_value: 1500 })));
    expect((await screen.findByTestId('cg-note')).textContent).toBe('Goal saved.');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Land 3 brand deals' }));
    fireEvent.change(within(screen.getByTestId('cg-editor')).getByTestId('cg-type'), { target: { value: 'primary' } });
    fireEvent.click(within(screen.getByTestId('cg-editor')).getByTestId('cg-save'));
    expect((await screen.findByRole('alert')).textContent).toBe('Only 1 primary goal');
    expect(screen.getByTestId('cg-editor')).toBeTruthy();
  });

  test('a goal is deleted only after a confirm', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    renderPage('?tab=goals');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Land 3 brand deals' }));
    expect(api.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Land 3 brand deals' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/world/show-1/goals/g2'));
    expect(confirm).toHaveBeenCalledWith('Delete "Land 3 brand deals"?');
    confirm.mockRestore();
  });

  test('Sync from stats syncs, names what it completed, and reloads the goals', async () => {
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/goals/sync') {
        state.goals = state.goals.map((g) => (g.id === 'g2' ? { ...g, status: 'completed' } : g));
        return { data: { success: true, synced: 2, completed: [{ title: 'Land 3 brand deals' }] } };
      }
      return { data: {} };
    });
    renderPage('?tab=goals');
    fireEvent.click(await screen.findByTestId('cg-sync'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/goals/sync'));
    expect((await screen.findByTestId('cg-note')).textContent).toBe('Synced 2 goals from her stats. Completed: Land 3 brand deals.');
    await waitFor(() => expect(screen.getByTestId('cg-counts').textContent).toBe('1 active · 2 complete'));
  });

  test('Suggest events lists suggestions from the active goals, each with its way to the event', async () => {
    state.suggestions = [
      { id: 'ev-7', name: 'Velour Garden Soirée', event_type: 'invite', prestige: 7, cost_coins: 150, is_paid: true, requirements_met: true,
        narrative_stakes: 'Her first luxury room.', suggestion_reasons: ['Moves reputation', 'Chain continues'] },
      { id: 'ev-8', name: 'Atelier Closing', prestige: 9, cost_coins: 400, requirements_met: false, suggestion_reasons: [] },
    ];
    renderPage('?tab=goals');
    fireEvent.click(await screen.findByTestId('cg-suggest'));
    const list = await screen.findByTestId('cg-suggestions');
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.some(([u]) => u === '/api/v1/world/show-1/suggest-events?limit=3')).toBe(true));
    const [first, second] = within(list).getAllByTestId('cg-suggestion');
    expect(first.textContent).toContain('Velour Garden Soirée');
    expect(first.textContent).toContain('Her first luxury room.');
    expect(first.textContent).toContain('Moves reputation · Chain continues');
    expect(within(first).getByRole('link', { name: 'View in Events' }).getAttribute('href')).toBe('/shows/show-1/world?tab=events&event=ev-7');
    expect(within(first).getByRole('link', { name: 'Open the event package' }).getAttribute('href')).toBe('/shows/show-1/events/ev-7');
    expect(within(second).getByText('Requirements not met')).toBeTruthy();
  });

  test('with no goals yet: Seed 24 goals runs the seed and the list fills', async () => {
    state.goals = [];
    vi.mocked(api.post).mockImplementation(async (url, body) => {
      if (url === '/api/v1/world/show-1/goals/seed') {
        expect(body).toEqual({ activate_tier: 1 });
        state.goals = GOALS.map((g) => ({ ...g }));
        return { data: { success: true, created: 24, skipped: 0 } };
      }
      return { data: {} };
    });
    renderPage('?tab=goals');
    expect(await screen.findByText('No active primary goal. New Goal adds one.')).toBeTruthy();
    fireEvent.click(screen.getByTestId('cg-seed'));
    expect((await screen.findByTestId('cg-note')).textContent).toBe('Seeded 24 goals.');
    expect(await screen.findByText('Break Into Luxury Fashion')).toBeTruthy();
    expect(screen.queryByTestId('cg-seed')).toBeNull();
  });

  test('the phases with their goals and the progression log, folded', async () => {
    state.arc = { ...ARC, progression_log: [{ triggered_by: 'manual', trigger_reason: 'Advanced by Evoni', timestamp: '2026-02-01T10:00:00Z', goals_carried: 1 }] };
    state.goals = GOALS.map((g) => ({ ...g, episode_range: g.id === 'g1' ? '[2, 6]' : [10, 12] }));
    renderPage('?tab=goals');
    const fold = await screen.findByTestId('season-phases-fold');
    expect(fold.tagName).toBe('DETAILS');
    const one = within(fold).getByTestId('cg-phase-1');
    expect(one.textContent).toContain('Phase 1: Foundation');
    expect(one.textContent).toContain('Goals (0/1 complete)');
    expect(within(one).getByText('🌟 Break Into Luxury Fashion')).toBeTruthy();
    expect(within(within(fold).getByTestId('cg-phase-2')).getByText('👠 First runway')).toBeTruthy();
    expect(within(fold).getByTestId('cg-log').textContent).toContain('Advanced by Evoni');
    expect(within(fold).getByTestId('cg-log').textContent).toContain('1 goals carried');
  });
});

describe('No season yet', () => {
  test('the setup form, open', async () => {
    state.arc = null;
    state.roadmap = null;
    renderPage();
    expect(await screen.findByTestId('szn-empty')).toBeTruthy();
    expect(screen.getByTestId('season-setup-form')).toBeTruthy();
  });
});
