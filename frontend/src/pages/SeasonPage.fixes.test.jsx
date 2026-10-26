/**
 * Season Plan PR 2, bugs, phone and layout (Evoni's review, 2026-10-24), on
 * the Season page (which replaced Producer Mode's Season Plan tab,
 * 2026-10-25): a reload after an accept or an advance keeps the page
 * mounted (an open fold and a typed draft survive); "Advance with N open
 * slots" and the final phase's unmet goals ask in the page first; a failed
 * load says so with Retry, never "No season set up yet"; the intention
 * editor sits inside the slot's panel (the phone's sheet); Story
 * Development keeps its order; no browser alert or prompt is left.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import SeasonPage from './SeasonPage';

const PHASES = [
  { phase: 1, title: 'Doors', tagline: 'Get in', status: 'active', episode_start: 1, episode_end: 8 },
  { phase: 2, title: 'Rooms', tagline: null, status: 'upcoming', episode_start: 9, episode_end: 16 },
  { phase: 3, title: 'Keys', tagline: null, status: 'upcoming', episode_start: 17, episode_end: 24 },
];
const ARC = {
  id: 'arc-2', title: 'Velvet Season', tagline: 'Her own room', season_number: 2, status: 'active', current_phase: 1, current_episode: 2,
  episode_end: 24, emotional_temperature: 'rising', narrative_debt: [], progression_log: [], phases: PHASES,
};
// Slots 1–5 done; 6–8 of Part 1 still open; the rest empty.
const DONE_UPTO = 5;
const slot = (n, doneUpto = DONE_UPTO) => ({
  id: `slot-${n}`, slot_number: n, phase: n <= 8 ? 1 : n <= 16 ? 2 : 3, label: `S2 · E${n}`,
  state: n <= doneUpto ? 'done' : 'needs_event', locked: n <= doneUpto,
  episode: n <= doneUpto ? { id: `ep-${n}`, title: `Made ${n}`, evaluation_status: 'accepted' } : null,
  event: null, intention: n <= doneUpto ? { story_purpose: 'Done' } : {}, intention_editable: n > doneUpto, result: {},
});
const roadmapFor = ({ currentPhase = 1, doneUpto = DONE_UPTO, boundary = null } = {}) => ({
  arc: { id: 'arc-2', title: 'Velvet Season', current_phase: currentPhase }, season_number: 2, slot_count: 24,
  counts: { done: doneUpto, in_production: 0, event_ready: 0, needs_event: 24 - doneUpto },
  phases: PHASES.map((p) => ({ ...p, slots: Array.from({ length: p.episode_end - p.episode_start + 1 }, (_, i) => slot(p.episode_start + i, doneUpto)) })),
  unslotted_episodes: [], available_events: [{ id: 'ev-1', name: 'Gala', status: 'draft' }],
  next_slot_number: doneUpto + 1, phase_boundary: boundary,
});

const PROPOSAL = {
  id: 'p1', status: 'proposed', summary: 'Sift is peaking.', signals: {},
  changes: [{ kind: 'slot_intention', slot_number: 9, story_purpose: 'Lala faces Sift', why: 'peaking' }],
};

let state;
function mockGets() {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { episodes: [] } };
    if (url === '/api/v1/shows/show-1') return { data: { id: 'show-1', title: 'Show' } };
    if (url === '/api/v1/world/show-1/arc') {
      if (state.arcFails > 0) { state.arcFails -= 1; throw Object.assign(new Error('Network Error'), { response: { data: { error: 'The server did not answer' } } }); }
      return { data: { arc: state.arc, next_season_number: 3 } };
    }
    if (url === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: state.roadmap } };
    if (url === '/api/v1/world/show-1/goals') return { data: { goals: state.goals } };
    // Before the threads list's migration: the Story tab shows the old card (Show/SeasonThreads fallback).
    if (url === '/api/v1/world/show-1/season/threads/inbox') return { data: { needs_migration: true } };
    if (url === '/api/v1/world/show-1/season/threads') return { data: { threads: [], drafts: state.drafts || [] } };
    if (url === '/api/v1/world/show-1/season/proposals') return { data: { open: state.proposal, recent: state.recent || [] } };
    if (url === '/api/v1/world/show-1/season/reveals') return { data: { arc: { id: 'arc-2' }, slots: [], secrets: [], reveals: [], warnings: [] } };
    if (url === '/api/v1/world/show-1/season/twists') return { data: { arc: { id: 'arc-2' }, slots: [], threads: [], characters: [], twists: [], warnings: [] } };
    return { data: {} };
  });
}
const callsTo = (fn, url) => vi.mocked(fn).mock.calls.filter(([u]) => u === url).length;

function renderSeason(tab = 'roadmap') {
  return render(
    <MemoryRouter initialEntries={[`/shows/show-1/season?tab=${tab}`]}>
      <Routes><Route path="/shows/:showId/season" element={<SeasonPage />} /></Routes>
    </MemoryRouter>
  );
}
const card = (n) => screen.getByTestId(`szn-slot-${n}`).querySelector('.szn-slot-open');
const openSlot = async (n) => { await screen.findByTestId(`szn-slot-${n}`); fireEvent.click(card(n)); };

let alertSpy;
let promptSpy;
beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.post).mockResolvedValue({ data: {} });
  state = { arc: ARC, roadmap: roadmapFor(), goals: [], proposal: null, arcFails: 0 };
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => null);
});
afterEach(() => {
  // No browser alert or prompt, in any test here.
  expect(alertSpy).not.toHaveBeenCalled();
  expect(promptSpy).not.toHaveBeenCalled();
  alertSpy.mockRestore();
  promptSpy.mockRestore();
});

describe('Reloading in place', () => {
  test('accepting a proposal reloads the season without unmounting: the open fold and what the season knows stay', async () => {
    state.proposal = PROPOSAL;
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url.endsWith('/proposals/p1/accept')) { state.proposal = null; return { data: { applied: [{ index: 0, ok: true }] } }; }
      return { data: {} };
    });
    renderSeason('overview');
    const fold = await screen.findByTestId('szn-fold-proposals');
    fold.open = true;
    await screen.findByTestId('season-knows');
    expect(callsTo(api.get, '/api/v1/world/show-1/arc')).toBe(1);
    const knowsReads = callsTo(api.get, '/api/v1/world/show-1/season/knows');

    fireEvent.click(await screen.findByRole('button', { name: 'Accept 1 of 1' }));
    await waitFor(() => expect(callsTo(api.get, '/api/v1/world/show-1/arc')).toBe(2));
    await waitFor(() => expect(callsTo(api.get, '/api/v1/world/show-1/season/roadmap')).toBe(2));
    // Still the same page: never "Loading", the fold still open, the note there, what the season knows not fetched again.
    expect(screen.queryByText('Loading the season…')).toBeNull();
    expect(screen.getByTestId('szn-fold-proposals')).toBe(fold);
    expect(fold.open).toBe(true);
    expect(await screen.findByText('Applied 1 change to the season.')).toBeTruthy();
    expect(callsTo(api.get, '/api/v1/world/show-1/season/knows')).toBe(knowsReads);
  });

  test('advancing a phase reloads in place too: a typed intention survives', async () => {
    state.roadmap = roadmapFor({ doneUpto: 8, boundary: { phase: 1, title: 'Doors', next_phase: { phase: 2, title: 'Rooms' }, outcomes: { pass: 8 }, goals: null } });
    vi.mocked(api.post).mockImplementation(async (url) => (url.endsWith('/arc/advance') ? { data: { data: { success: true } } } : { data: {} }));
    renderSeason();
    await openSlot(10);
    fireEvent.click(screen.getByTestId('season-intention-10'));
    const editor = await screen.findByTestId('season-intention-editor');
    fireEvent.change(within(editor).getByLabelText('Story purpose 1'), { target: { value: 'Keep me' } });
    fireEvent.click(screen.getByTestId('season-advance'));
    await waitFor(() => expect(callsTo(api.get, '/api/v1/world/show-1/arc')).toBe(2));
    await waitFor(() => expect(callsTo(api.get, '/api/v1/world/show-1/season/insights')).toBe(2));
    expect(within(screen.getByTestId('season-intention-editor')).getByLabelText('Story purpose 1').value).toBe('Keep me');
  });
});

describe('Advancing', () => {
  test('"Advance with 3 open slots": the confirm step in the page says which slots stay open, then confirms', async () => {
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url.endsWith('/arc/advance')) {
        return { data: { data: {
          needs_confirmation: true, is_final: false, warning: null, unmet_goals: [],
          open_slots: [6, 7, 8].map((n) => ({ slot_number: n, label: `S2 · E${n}`, state: 'needs_event' })),
          current_phase: { phase: 1, title: 'Doors' }, next_phase: { phase: 2, title: 'Rooms' },
        } } };
      }
      return { data: { data: { success: true } } };
    });
    renderSeason();
    const bar = await screen.findByTestId('season-advance-open');
    expect(bar.textContent).toMatch(/Part 1: Doors · 5 of 8 slots done/);
    expect(screen.queryByTestId('season-phase-boundary')).toBeNull();
    fireEvent.click(within(bar).getByTestId('season-advance-open-btn'));
    expect(within(bar).getByTestId('season-advance-open-btn').textContent).toBe('Checking...');

    const confirm = await within(bar).findByTestId('season-phase-confirm');
    expect(within(confirm).getByText('Advance to Phase 2: Rooms?')).toBeTruthy();
    expect(within(confirm).getByTestId('season-confirm-open-slots').textContent)
      .toBe('3 slots stay open: E6, E7, E8. They stay in Part 1 and can still be filled.');
    expect(callsTo(api.post, '/api/v1/world/show-1/arc/advance/confirm')).toBe(0);
    fireEvent.click(within(confirm).getByText('Confirm: advance with open slots'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/arc/advance/confirm'));
  });

  test('the button reads "Advance with 1 open slot" for one, and Cancel closes the step without advancing', async () => {
    state.roadmap = roadmapFor({ doneUpto: 7 });
    vi.mocked(api.post).mockResolvedValue({ data: { data: { needs_confirmation: true, open_slots: [{ slot_number: 8 }], unmet_goals: [], current_phase: { phase: 1 }, next_phase: { phase: 2, title: 'Rooms' } } } });
    renderSeason();
    const btn = await screen.findByTestId('season-advance-open-btn');
    expect(btn.textContent).toBe('Advance with 1 open slot');
    fireEvent.click(btn);
    const confirm = await screen.findByTestId('season-phase-confirm');
    expect(within(confirm).getByTestId('season-confirm-open-slots').textContent).toMatch(/^1 slot stays open: E8\./);
    fireEvent.click(within(confirm).getByText('Cancel'));
    expect(screen.queryByTestId('season-phase-confirm')).toBeNull();
    expect(callsTo(api.post, '/api/v1/world/show-1/arc/advance/confirm')).toBe(0);
  });

  // "Only show it once a slot is done" (Evoni, 2026-10-25).
  test('with no slot of the current part done there is no advance bar', async () => {
    state.roadmap = roadmapFor({ doneUpto: 0 });
    renderSeason();
    await screen.findByTestId('szn-roadmap');
    expect(screen.queryByTestId('season-advance-open')).toBeNull();
    expect(screen.queryByTestId('season-advance-open-btn')).toBeNull();
  });

  test('one slot of the current part done: "Advance with 7 open slots"', async () => {
    state.roadmap = roadmapFor({ doneUpto: 1 });
    renderSeason();
    const bar = await screen.findByTestId('season-advance-open');
    expect(bar.textContent).toMatch(/Part 1: Doors · 1 of 8 slots done/);
    expect(within(bar).getByTestId('season-advance-open-btn').textContent).toBe('Advance with 7 open slots');
  });

  test('the final phase lists the unmet goals before completing the season', async () => {
    state.arc = { ...ARC, current_phase: 3 };
    state.roadmap = roadmapFor({ currentPhase: 3, doneUpto: 24, boundary: { phase: 3, title: 'Keys', next_phase: null, outcomes: { pass: 8 }, goals: { total: 3, completed: 1, unmet: 2 } } });
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url.endsWith('/arc/advance')) {
        return { data: { data: {
          needs_confirmation: true, is_final: true, open_slots: [], warning: 'Phase "Keys" has 1 incomplete primary goal(s).',
          unmet_goals: [
            { id: 'g1', title: 'Hit rep 8', type: 'primary', target_metric: 'reputation', current_value: 6, target_value: 8 },
            { id: 'g2', title: 'Land a cover', type: 'secondary', target_metric: 'portfolio_strength', current_value: 0, target_value: 1 },
          ],
          current_phase: { phase: 3, title: 'Keys' }, next_phase: null,
        } } };
      }
      return { data: { data: { success: true, arc_completed: true } } };
    });
    renderSeason();
    const box = await screen.findByTestId('season-phase-boundary');
    expect(box.textContent).toMatch(/Advancing completes the season\./);
    fireEvent.click(within(box).getByText('Complete the season'));
    const confirm = await within(box).findByTestId('season-phase-confirm');
    expect(within(confirm).getByText('Complete the season?')).toBeTruthy();
    const unmet = within(confirm).getByTestId('season-confirm-unmet');
    expect(unmet.textContent).toMatch(/2 goals are unmet\. Completing the season leaves them unmet\./);
    expect(within(unmet).getByText('Hit rep 8')).toBeTruthy();
    expect(unmet.textContent).toMatch(/Hit rep 8 \(6\/8 reputation\)/);
    expect(unmet.textContent).toMatch(/Land a cover \(0\/1 portfolio strength\)/);
    expect(callsTo(api.post, '/api/v1/world/show-1/arc/advance/confirm')).toBe(0);
    fireEvent.click(within(confirm).getByText('Confirm: complete the season'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/arc/advance/confirm'));
  });

  test('an advance that fails says so in the page, not in an alert', async () => {
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('boom'), { response: { data: { error: 'No active arc found' } } }));
    renderSeason();
    fireEvent.click(await screen.findByTestId('season-advance-open-btn'));
    expect((await screen.findByTestId('season-advance-error')).textContent).toBe('No active arc found');
  });
});

describe('A load that fails', () => {
  test('shows an error with Retry, never "No season set up yet"; Retry loads the season', async () => {
    state.arcFails = 1;
    renderSeason();
    const err = await screen.findByTestId('season-load-error');
    expect(err.textContent).toMatch(/The season could not be loaded \(The server did not answer\)\./);
    expect(screen.queryByTestId('szn-empty')).toBeNull();
    expect(screen.queryByText(/No season set up yet/)).toBeNull();
    fireEvent.click(within(err).getByTestId('season-load-retry'));
    expect(await screen.findByTestId('szn-hero')).toBeTruthy();
    expect(screen.queryByTestId('season-load-error')).toBeNull();
  });

  test('a part that fails (the roadmap) is named, the rest of the tab stays', async () => {
    const inner = vi.mocked(api.get).getMockImplementation();
    let roadmapFails = 1;
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/season/roadmap' && roadmapFails > 0) { roadmapFails -= 1; throw new Error('Request failed with status code 500'); }
      return inner(url);
    });
    renderSeason();
    const err = await screen.findByTestId('season-load-error');
    expect(err.textContent).toMatch(/Some of the season did not load: the roadmap\./);
    expect(screen.getByTestId('szn-hero')).toBeTruthy();
    fireEvent.click(within(err).getByTestId('season-load-retry'));
    expect(await screen.findByTestId('szn-roadmap')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('season-load-error')).toBeNull());
  });
});

describe('Layout', () => {
  test('Story Development: the threads, then the twists, the reveal plan and the relationships needed', async () => {
    renderSeason('story');
    const threads = await screen.findByTestId('story-threads');
    const twists = await screen.findByTestId('season-twists');
    const reveals = await screen.findByTestId('season-reveal-plan');
    const needs = await screen.findByTestId('season-needs');
    const after = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(after(threads, twists)).toBe(true);
    expect(after(twists, reveals)).toBe(true);
    expect(after(reveals, needs)).toBe(true);
  });

  describe('at phone width (375px)', () => {
    let width;
    beforeEach(() => { width = window.innerWidth; window.innerWidth = 375; window.dispatchEvent(new Event('resize')); });
    afterEach(() => { window.innerWidth = width; });

    test('Edit intention opens the editor inside the slot\'s sheet, under its button', async () => {
      renderSeason();
      await openSlot(7);
      const side = document.querySelector('.wa-arc-side');
      expect(side.classList.contains('is-sheet-open')).toBe(true);
      const panel = within(side).getByTestId('season-slot-panel');
      fireEvent.click(within(panel).getByTestId('season-intention-7'));
      const editor = within(panel).getByTestId('season-intention-editor');
      expect(editor.textContent).toMatch(/S2 · E7 intention/);
      expect(within(panel).getByTestId('season-intention-7').getAttribute('aria-expanded')).toBe('true');
      // Not under the grid any more.
      expect(document.querySelector('.szn-parts [data-testid="season-intention-editor"]')).toBeNull();
      // Another slot closes it.
      fireEvent.click(card(8));
      expect(screen.queryByTestId('season-intention-editor')).toBeNull();
    });

    test('a failed save shows in the editor, inside the sheet', async () => {
      vi.mocked(api.put).mockRejectedValue(Object.assign(new Error('x'), { response: { data: { error: 'S2 · E7 is locked' } } }));
      renderSeason();
      await openSlot(7);
      fireEvent.click(screen.getByTestId('season-intention-7'));
      const editor = screen.getByTestId('season-intention-editor');
      fireEvent.click(within(editor).getByText('Save'));
      expect((await within(editor).findByTestId('season-intention-error')).textContent).toBe('S2 · E7 is locked');
    });
  });
});

describe('In-page messages, no browser alert or prompt', () => {
  test('a pencil that fails says so in the slot\'s panel', async () => {
    vi.mocked(api.put).mockRejectedValue(Object.assign(new Error('x'), { response: { data: { error: 'That event is in S2 · E9' } } }));
    renderSeason();
    await openSlot(7);
    fireEvent.change(screen.getByTestId('season-pencil-7'), { target: { value: 'ev-1' } });
    const panel = screen.getByTestId('season-slot-panel');
    expect((await within(panel).findByTestId('season-slot-error')).textContent).toBe('That event is in S2 · E9');
  });

  test('a thread that fails to close says so in the threads card', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      // Before the threads list's migration: the Story tab shows the old card (Show/SeasonThreads fallback).
      if (url === '/api/v1/world/show-1/season/threads/inbox') return { data: { needs_migration: true } };
      if (url === '/api/v1/world/show-1/season/threads') return { data: { threads: [{ id: 'th-1', title: 'Rival', status: 'open' }], drafts: [] } };
      if (url === '/api/v1/world/show-1/arc') return { data: { arc: ARC } };
      if (url === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: state.roadmap } };
      return { data: {} };
    });
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('x'), { response: { data: { error: 'Thread not found' } } }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderSeason('story');
    const threadsCard = await screen.findByTestId('story-threads');
    fireEvent.click(await within(threadsCard).findByText('Close'));
    expect((await within(threadsCard).findByTestId('story-threads-error')).textContent).toBe('Thread not found');
    confirm.mockRestore();
  });

  test('"Make a thread" is a small inline form; Cancel closes it; a failure shows in the card', async () => {
    state.drafts = [{ seed_text: 'Maison Belle calls back', episode_id: 'ep-1', episode_title: 'Gala' }];
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('x'), { response: { data: { error: 'A thread with that title exists' } } }));
    renderSeason('story');
    const drafts = await screen.findByTestId('story-thread-drafts');
    fireEvent.click(within(drafts).getByTestId('story-thread-make'));
    const form = within(drafts).getByTestId('story-thread-name-form');
    expect(within(form).getByLabelText('Thread name').value).toBe('Maison Belle calls back');
    fireEvent.click(within(form).getByText('Cancel'));
    expect(within(drafts).queryByTestId('story-thread-name-form')).toBeNull();
    fireEvent.click(within(drafts).getByTestId('story-thread-make'));
    fireEvent.click(within(drafts).getByTestId('story-thread-name-save'));
    expect((await screen.findByTestId('story-threads-error')).textContent).toBe('A thread with that title exists');
    // The form stays open with her name, to try again.
    expect(within(drafts).getByTestId('story-thread-name-form')).toBeTruthy();
  });

  test('the Season page\'s source has no alert() or window.prompt() left', () => {
    // The Season Plan's pieces live in components/Show/SeasonPlan.jsx (the Season page, 2026-10-25).
    const plan = readFileSync(resolve(__dirname, '../components/Show/SeasonPlan.jsx'), 'utf8');
    const season = plan.slice(plan.indexOf('export function StoryThreadsCard'));
    expect(season.length).toBeGreaterThan(1000);
    expect(season).not.toMatch(/\balert\(/);
    expect(season).not.toMatch(/\bprompt\(/);
    for (const file of ['SeasonProposals.jsx', 'SeasonRevealPlan.jsx', 'SeasonTwists.jsx', 'SeasonSetup.jsx', 'SeasonTwistLine.jsx', 'SeasonPicturePicker.jsx',
      'CareerGoals.jsx', 'SeasonPageOverview.jsx', 'SeasonPageRoadmap.jsx', 'SeasonThreads.jsx']) {
      const src = readFileSync(resolve(__dirname, '../components/Show', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(src, file).not.toMatch(/\balert\(/);
      expect(src, file).not.toMatch(/\bprompt\(/);
    }
  });
});

describe('The goals count', () => {
  test('the Season Goals card counts the completed goals; a missed one is not remaining (item 6, fixed in PR 1)', async () => {
    state.goals = [
      { id: 'g1', status: 'completed', title: 'A' }, { id: 'g2', status: 'completed', title: 'B' },
      { id: 'g3', status: 'active', title: 'C' }, { id: 'g4', status: 'failed', title: 'D' },
    ];
    renderSeason('overview');
    expect((await screen.findByTestId('szn-stat-goals')).textContent).toContain('2 complete · 1 remaining');
    expect(screen.getByTestId('szn-stat-slots').textContent).toContain('5 completed · 19 remaining');
    const hero = screen.getByTestId('szn-hero');
    expect(within(hero).getByText('Season 2')).toBeTruthy();
    expect(within(hero).getByRole('heading', { level: 1 }).textContent).toBe('Velvet Season');
  });
});

beforeEach(() => mockGets());
