/**
 * Season Arc build PR 1 (Evoni's rulings, 2026-10-01; EVENT_EPISODE_FLOW.md
 * §8(ff)): the Season tab centres on the 24-slot roadmap, each slot showing
 * its state (A2), numbered "S1 · E7" (Q3); episodes in no slot are listed
 * (Q4); Extend is removed (Q2).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';

const ARC = {
  title: 'Soft Luxury Ascension',
  tagline: 'The climb begins.',
  current_phase: 1,
  current_episode: 1,
  episode_end: 24,
  emotional_temperature: 'rising',
  narrative_debt: [],
  progression_log: [],
  phases: [{ phase: 1, title: 'Foundation', status: 'active', episode_start: 1, episode_end: 8 }],
};

const STATES = ['in_production', 'event_ready'];
function slot(n) {
  const state = STATES[n - 1] || 'needs_event';
  return {
    id: `slot-${n}`,
    slot_number: n,
    phase: Math.ceil(n / 8),
    label: `S1 · E${n}`,
    state,
    locked: n === 1,
    episode: n === 1 ? { id: 'ep-1', title: 'Gala Night' } : null,
    event: n === 2 ? { id: 'ev-2', name: 'Rooftop Launch' } : null,
    intention: {},
    result: {},
  };
}
const ROADMAP = {
  arc: { id: 'arc-1', title: 'Soft Luxury Ascension' },
  season_number: 1,
  slot_count: 24,
  counts: { done: 0, in_production: 1, event_ready: 1, needs_event: 22 },
  phases: [
    { phase: 1, title: 'Foundation', episode_start: 1, episode_end: 8, slots: [1, 2, 3, 4, 5, 6, 7, 8].map(slot) },
    { phase: 2, title: 'Ascension', episode_start: 9, episode_end: 16, slots: [9, 10, 11, 12, 13, 14, 15, 16].map(slot) },
    { phase: 3, title: 'Legacy', episode_start: 17, episode_end: 24, slots: [17, 18, 19, 20, 21, 22, 23, 24].map(slot) },
  ],
  unslotted_episodes: [{ id: 'ep-old', title: 'Pilot Test', status: 'draft', evaluation_status: null }],
  available_events: [{ id: 'ev-9', name: 'Gallery Night', status: 'draft' }],
};

function renderAt(tab) {
  return render(
    <MemoryRouter initialEntries={[`/shows/show-1/world?tab=${tab}`]}>
      <Routes>
        <Route path="/shows/:id/world" element={<WorldAdmin />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Season Arc roadmap (§8(ff) PR 1)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) {
        return { data: { episodes: [{ id: 'ep-1', episode_number: 1, title: 'Gala Night', status: 'draft' }] } };
      }
      if (url === '/api/v1/shows/show-1') return { data: { id: 'show-1', title: 'Show' } };
      if (url === '/api/v1/world/show-1/arc') return { data: { arc: ARC } };
      if (url === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: ROADMAP } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
  });

  test('shows the 24 slots by phase, each with its S1 · E label and state', async () => {
    renderAt('season');

    const roadmap = await screen.findByTestId('season-roadmap');
    expect(within(roadmap).getByText('Roadmap · Season 1')).toBeTruthy();
    expect(within(roadmap).getByText(/Phase 1 · Foundation/)).toBeTruthy();
    expect(within(roadmap).getByText(/Phase 3 · Legacy/)).toBeTruthy();
    expect(roadmap.querySelectorAll('[data-testid^="season-slot-"]')).toHaveLength(24);

    const first = screen.getByTestId('season-slot-1');
    expect(within(first).getByText('S1 · E1')).toBeTruthy();
    expect(within(first).getByText('In production')).toBeTruthy();
    expect(within(first).getByText('Gala Night')).toBeTruthy();
    expect(within(first).getByText('Locked')).toBeTruthy();

    const second = screen.getByTestId('season-slot-2');
    expect(within(second).getByText('Event ready')).toBeTruthy();
    expect(within(second).getByText('Rooftop Launch')).toBeTruthy();

    expect(within(screen.getByTestId('season-slot-24')).getByText('Needs an event')).toBeTruthy();
  });

  test('lists episodes that are in no slot', async () => {
    renderAt('season');

    const unslotted = await screen.findByTestId('season-unslotted');
    expect(within(unslotted).getByText('Not in a slot (1)')).toBeTruthy();
    expect(within(unslotted).getByText('Pilot Test')).toBeTruthy();
  });

  test('offers no Extend control and never calls /arc/extend', async () => {
    renderAt('season');

    await waitFor(() => expect(screen.getByText(/Season 1: Soft Luxury Ascension/)).toBeTruthy());
    expect(screen.queryByText(/Extend/i)).toBeNull();
    const extends_ = vi.mocked(api.post).mock.calls.filter(([url]) => /\/arc\/extend$/.test(url));
    expect(extends_).toEqual([]);
  });

  test('a future slot can have an event pencilled in, moved or cleared (Q5); a started slot cannot', async () => {
    renderAt('season');
    await screen.findByTestId('season-roadmap');

    expect(screen.queryByTestId('season-pencil-1')).toBeNull(); // E1 is locked to its episode

    fireEvent.change(screen.getByTestId('season-pencil-4'), { target: { value: 'ev-9' } });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/api/v1/world/show-1/season/slots/slot-4/event', { event_id: 'ev-9' }));

    const second = screen.getByTestId('season-pencil-2');
    expect(within(second).getByText('Clear this slot')).toBeTruthy();
    fireEvent.change(second, { target: { value: '__clear__' } });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/api/v1/world/show-1/season/slots/slot-2/event', { event_id: null }));

    // The roadmap reloads after each change.
    const reloads = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/api/v1/world/show-1/season/roadmap');
    expect(reloads.length).toBeGreaterThanOrEqual(3);
  });

  test('an episode in no slot can be placed in an open slot after a confirm (Q4)', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt('season');

    const select = await screen.findByTestId('season-place-ep-old');
    expect(within(select).queryByText('S1 · E1')).toBeNull(); // locked slots are not offered
    fireEvent.change(select, { target: { value: 'slot-3' } });

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/api/v1/world/show-1/season/slots/slot-3/episode', { episode_id: 'ep-old' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('S1 · E3'));
    confirm.mockRestore();
  });

  test('marks the next open slot (A6)', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/arc') return { data: { arc: ARC } };
      if (url === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: { ...ROADMAP, next_slot_number: 2 } } };
      return { data: {} };
    });
    renderAt('season');

    expect(within(await screen.findByTestId('season-slot-2')).getByText('Next')).toBeTruthy();
    expect(within(screen.getByTestId('season-slot-3')).queryByText('Next')).toBeNull();
  });

  test('at a phase boundary it shows the summary and asks before advancing (Q6)', async () => {
    const boundary = {
      phase: 1, title: 'Foundation',
      next_phase: { phase: 2, title: 'Ascension', tagline: 'Climb the ladder' },
      outcomes: { pass: 5, slay: 1, fail: 2 },
      goals: { total: 4, completed: 3, unmet: 1, warning: 'Save 2,000 coins is unmet' },
    };
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/arc') return { data: { arc: ARC } };
      if (url === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: { ...ROADMAP, phase_boundary: boundary } } };
      return { data: {} };
    });
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/arc/advance') {
        return { data: { data: { needs_confirmation: true, warning: 'Phase "Foundation" has 1 incomplete primary goal(s).' } } };
      }
      return { data: {} };
    });
    renderAt('season');

    const card = await screen.findByTestId('season-phase-boundary');
    expect(within(card).getByText('Phase 1: Foundation is complete')).toBeTruthy();
    expect(within(card).getByText('Results: 5 pass · 1 slay · 2 fail')).toBeTruthy();
    expect(within(card).getByText(/3 of 4 complete; 1 unmet will be carried as narrative debt/)).toBeTruthy();
    expect(within(card).getByText(/Advancing opens Phase 2: Ascension/)).toBeTruthy();
    expect(vi.mocked(api.post).mock.calls.filter(([url]) => /\/arc\/advance/.test(url))).toEqual([]);

    fireEvent.click(within(card).getByText('Advance to Phase 2'));
    const confirmBox = await screen.findByTestId('season-phase-confirm');
    expect(within(confirmBox).getByText(/1 incomplete primary goal/)).toBeTruthy();
    expect(vi.mocked(api.post).mock.calls.some(([url]) => url === '/api/v1/world/show-1/arc/advance/confirm')).toBe(false);

    fireEvent.click(within(confirmBox).getByText('Confirm: advance and carry the debt'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/arc/advance/confirm'));
  });

  test('a future slot\'s intention can be edited and saved (A3, Q7, Q10); a started slot has none to edit', async () => {
    renderAt('season');
    await screen.findByTestId('season-roadmap');
    expect(screen.queryByTestId('season-intention-1')).toBeNull(); // E1 is locked

    fireEvent.click(screen.getByTestId('season-intention-3'));
    const editor = await screen.findByTestId('season-intention-editor');
    expect(within(editor).getByText('S1 · E3 intention')).toBeTruthy();
    fireEvent.change(within(editor).getByLabelText('Story purpose'), { target: { value: 'Lala bluffs her way in' } });
    fireEvent.change(within(editor).getByLabelText('Career focus'), { target: { value: 'reputation' } });
    fireEvent.change(within(editor).getByLabelText('Desired pressure'), { target: { value: 'High' } });
    fireEvent.change(within(editor).getByLabelText('Lowest outcome'), { target: { value: 'pass' } });
    fireEvent.change(within(editor).getByLabelText('Highest outcome'), { target: { value: 'slay' } });
    fireEvent.click(within(editor).getByText('Save'));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/season/slots/slot-3/intention', {
      story_purpose: 'Lala bluffs her way in', career_focus: 'reputation', desired_pressure: 'High',
      outcome_range: { min: 'pass', max: 'slay' },
    }));
  });

  test('Draft with AI asks before replacing an edited intention, then sends force', async () => {
    const edited = { ...ROADMAP, phases: ROADMAP.phases.map((p, i) => (i === 0 ? {
      ...p, slots: p.slots.map((sl) => (sl.slot_number === 4 ? { ...sl, intention: { story_purpose: 'Mine', source: 'edited' } } : sl)),
    } : p)) };
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/arc') return { data: { arc: ARC } };
      if (url === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: edited } };
      return { data: {} };
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt('season');

    fireEvent.click(await screen.findByTestId('season-intention-4'));
    const editor = await screen.findByTestId('season-intention-editor');
    expect(within(editor).getByText('Edited')).toBeTruthy();
    fireEvent.click(within(editor).getByText('Draft with AI'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/season/slots/slot-4/intention/draft', { force: true }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('was edited'));
    confirm.mockRestore();
  });
});
