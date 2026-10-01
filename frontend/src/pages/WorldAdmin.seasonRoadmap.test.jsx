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

  test('a future slot\'s intention can be edited and saved (A3, Q7, Q10); a locked slot with no flag has none to edit', async () => {
    renderAt('season');
    await screen.findByTestId('season-roadmap');
    expect(screen.queryByTestId('season-intention-1')).toBeNull(); // E1 is locked

    fireEvent.click(screen.getByTestId('season-intention-3'));
    const editor = await screen.findByTestId('season-intention-editor');
    expect(within(editor).getByText('S1 · E3 intention')).toBeTruthy();
    fireEvent.change(within(editor).getByLabelText('Story purpose 1'), { target: { value: 'Lala bluffs her way in' } });
    fireEvent.change(within(editor).getByLabelText('Career focus'), { target: { value: 'reputation' } });
    fireEvent.change(within(editor).getByLabelText('Desired pressure'), { target: { value: 'High' } });
    fireEvent.change(within(editor).getByLabelText('Lowest outcome'), { target: { value: 'pass' } });
    fireEvent.change(within(editor).getByLabelText('Highest outcome'), { target: { value: 'slay' } });
    fireEvent.click(within(editor).getByText('Save'));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/season/slots/slot-3/intention', {
      story_purposes: [{ text: 'Lala bluffs her way in', primary: true, story_thread_id: null }],
      career_focus: 'reputation', desired_pressure: 'High', outcome_range: { min: 'pass', max: 'slay' },
    }));
  });

  test('a started slot stays editable while its episode is a draft, and says so; an accepted one does not (A9)', async () => {
    const started = { ...ROADMAP, phases: ROADMAP.phases.map((p, i) => (i === 0 ? {
      ...p, slots: p.slots.map((sl) => {
        if (sl.slot_number === 1) return { ...sl, intention_editable: true, intention: { story_purpose: 'Her first gala', source: 'edited' } };
        if (sl.slot_number === 2) return { ...sl, locked: true, episode: { id: 'ep-2', title: 'Done' }, intention_editable: false };
        return sl;
      }),
    } : p)) };
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/arc') return { data: { arc: ARC } };
      if (url === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: started } };
      return { data: {} };
    });
    renderAt('season');
    await screen.findByTestId('season-roadmap');
    expect(screen.queryByTestId('season-intention-2')).toBeNull(); // accepted: locked for good

    fireEvent.click(screen.getByTestId('season-intention-1'));
    const editor = await screen.findByTestId('season-intention-editor');
    expect(within(editor).getByTestId('season-intention-started').textContent).toMatch(/editable while its episode is a draft/);
    fireEvent.change(within(editor).getByLabelText('Story purpose 1'), { target: { value: 'Her first gala, on borrowed shoes' } });
    fireEvent.click(within(editor).getByText('Save'));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/season/slots/slot-1/intention',
      expect.objectContaining({ story_purposes: [{ text: 'Her first gala, on borrowed shoes', primary: true, story_thread_id: null }] })));
  });

  test('a started slot can be drafted with AI from its episode, with no confirm and no force (A9 as changed)', async () => {
    const started = { ...ROADMAP, phases: ROADMAP.phases.map((p, i) => (i === 0 ? {
      ...p, slots: p.slots.map((sl) => (sl.slot_number === 1
        ? { ...sl, intention_editable: true, intention: { story_purpose: 'Her first gala', source: 'edited' } } : sl)),
    } : p)) };
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/arc') return { data: { arc: ARC } };
      if (url === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: started } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, started: true, placed: 'added', kept_edited: 1 } });
    const confirm = vi.spyOn(window, 'confirm');
    renderAt('season');

    fireEvent.click(await screen.findByTestId('season-intention-1'));
    const editor = await screen.findByTestId('season-intention-editor');
    expect(within(editor).getByTestId('season-intention-started').textContent).toMatch(/Draft with AI reads its event and script and keeps the purposes you edited/);
    fireEvent.click(within(editor).getByText('Draft with AI'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/season/slots/slot-1/intention/draft', {}));
    expect(confirm).not.toHaveBeenCalled();
    expect(await screen.findByText('S1 · E1 intention drafted from its episode; 1 edited purpose kept')).toBeTruthy();
    confirm.mockRestore();
  });

  test('a slot holds up to three purposes with one primary; the card shows the primary with "+N more" (A10)', async () => {
    const multi = { ...ROADMAP, phases: ROADMAP.phases.map((p, i) => (i === 0 ? {
      ...p, slots: p.slots.map((sl) => (sl.slot_number === 3 ? { ...sl, intention: {
        story_purpose: 'Lala bluffs her way in', source: 'edited',
        story_purposes: [
          { text: 'Lala bluffs her way in', primary: true, story_thread: null },
          { text: 'The rival notices', primary: false, story_thread: null },
        ],
      } } : sl)),
    } : p)) };
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/arc') return { data: { arc: ARC } };
      if (url === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: multi } };
      return { data: {} };
    });
    renderAt('season');

    expect((await screen.findByTestId('season-slot-purpose-3')).textContent).toBe('Lala bluffs her way in +1 more');
    fireEvent.click(screen.getByTestId('season-intention-3'));
    const editor = await screen.findByTestId('season-intention-editor');
    expect(within(editor).getByLabelText('Story purpose 2').value).toBe('The rival notices');

    fireEvent.click(within(editor).getByTestId('season-purpose-add'));
    expect(within(editor).queryByTestId('season-purpose-add')).toBeNull(); // three is the most
    fireEvent.change(within(editor).getByLabelText('Story purpose 3'), { target: { value: 'Her mother calls' } });
    fireEvent.click(within(editor).getByLabelText('Primary purpose 2'));
    fireEvent.click(within(editor).getByText('Save'));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/season/slots/slot-3/intention',
      expect.objectContaining({ story_purposes: [
        { text: 'Lala bluffs her way in', primary: false, story_thread_id: null },
        { text: 'The rival notices', primary: true, story_thread_id: null },
        { text: 'Her mother calls', primary: false, story_thread_id: null },
      ] })));
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

  describe('story threads (§8(ff) A3, Q9)', () => {
    const THREADS = {
      threads: [
        { id: 'th-1', title: 'The rival from E1', description: 'She keeps showing up', status: 'open', source: 'evoni', slot_numbers: [3] },
        { id: 'th-2', title: 'Old debt', status: 'closed', source: 'seed', slot_numbers: [] },
      ],
      drafts: [{ seed_text: 'Maison Belle calls back', episode_id: 'ep-1', episode_title: 'Gala Night' }],
    };
    beforeEach(() => {
      vi.mocked(api.get).mockImplementation(async (url) => {
        if (url === '/api/v1/world/show-1/arc') return { data: { arc: ARC } };
        if (url === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: ROADMAP } };
        if (url === '/api/v1/world/show-1/season/threads') return { data: THREADS };
        return { data: {} };
      });
      vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    });

    test('lists threads with their status and slots; only open ones can be closed, after a confirm', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderAt('season');

      const card = await screen.findByTestId('story-threads');
      const open = within(card).getByTestId('story-thread-th-1');
      expect(open.textContent).toMatch(/The rival from E1/);
      expect(open.textContent).toMatch(/Open · in E3/);
      expect(within(within(card).getByTestId('story-thread-th-2')).queryByText('Close')).toBeNull();

      fireEvent.click(within(open).getByText('Close'));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/season/threads/th-1/close'));
      expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Close "The rival from E1"?'));
      confirm.mockRestore();
    });

    test('a closed thread can be reopened, only after a confirm (PR 7 choice 1)', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
      renderAt('season');

      const card = await screen.findByTestId('story-threads');
      expect(within(within(card).getByTestId('story-thread-th-1')).queryByText('Reopen')).toBeNull();
      const closed = within(card).getByTestId('story-thread-th-2');

      fireEvent.click(within(closed).getByText('Reopen'));
      expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Reopen "Old debt"? It keeps its history'));
      expect(api.post).not.toHaveBeenCalledWith('/api/v1/world/show-1/season/threads/th-2/reopen');

      fireEvent.click(within(closed).getByText('Reopen'));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/season/threads/th-2/reopen'));
      confirm.mockRestore();
    });

    test('Evoni creates and names a thread, by hand or from a seed draft', async () => {
      const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Maison Belle returns');
      renderAt('season');

      const card = await screen.findByTestId('story-threads');
      fireEvent.change(within(card).getByLabelText('New thread title'), { target: { value: 'Her mother\'s visit' } });
      fireEvent.click(within(card).getByText('Add thread'));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/season/threads', { title: 'Her mother\'s visit', description: '' }));

      fireEvent.click(within(screen.getByTestId('story-thread-drafts')).getByText('Make a thread'));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/season/threads',
        { title: 'Maison Belle returns', seed_text: 'Maison Belle calls back', episode_id: 'ep-1' }));
      prompt.mockRestore();
    });

    test('a slot\'s intention can name the thread it continues; closed threads are not offered', async () => {
      renderAt('season');
      fireEvent.click(await screen.findByTestId('season-intention-5'));
      const editor = await screen.findByTestId('season-intention-editor');
      const select = within(editor).getByLabelText('Story thread 1');
      expect(within(select).queryByText('Old debt')).toBeNull();
      fireEvent.change(select, { target: { value: 'th-1' } });
      fireEvent.click(within(editor).getByText('Save'));

      await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/season/slots/slot-5/intention',
        expect.objectContaining({ story_purposes: [{ text: '', primary: true, story_thread_id: 'th-1' }] })));
    });
  });

  describe('Planning Insights (§8(ff) A8, Q13, Q15, PR 8)', () => {
    const INSIGHTS = {
      season_number: 1,
      health: { accepted: 3, with_range: 2, in_range: 1, without_range: 1 },
      money: {
        season: { income: 300, spend: 120, net: 180 },
        balance: 1130,
        trend: [
          { amount: 1000, balance_after: 1000, between_episodes: true, slot_label: null },
          { amount: 300, balance_after: 1300, between_episodes: false, slot_label: 'S1 · E1' },
          { amount: -120, balance_after: 1180, between_episodes: false, slot_label: 'S1 · E1' },
          { amount: -50, balance_after: 1130, between_episodes: true, slot_label: null },
        ],
      },
      phases: [{
        phase: 1, title: 'Foundation', totals: { income: 300, spend: 120, net: 180 }, unplanned_count: 6,
        slots: [
          { slot_number: 1, label: 'S1 · E1', episode: { id: 'ep-1', title: 'Gala Night' },
            planned: { desired_pressure: 'Medium', outcome_range: { min: 'pass', max: 'slay' } },
            actual: { outcome: 'pass', pressure: 'High' }, pressure_delta: 1, outcome_in_range: true,
            money: { income: 300, spend: 120, net: 180 } },
          { slot_number: 4, label: 'S1 · E4', episode: null,
            planned: { desired_pressure: 'Low', outcome_range: null },
            actual: { outcome: null, pressure: null }, pressure_delta: null, outcome_in_range: null, money: null },
        ],
      }],
    };
    beforeEach(() => {
      vi.mocked(api.get).mockImplementation(async (url) => {
        if (url === '/api/v1/world/show-1/arc') return { data: { arc: ARC } };
        if (url === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: ROADMAP } };
        if (url === '/api/v1/world/show-1/season/insights') return { data: { insights: INSIGHTS } };
        return { data: {} };
      });
    });

    test('shows the season-health line from the outcome ranges, and no longer reads the 1/4/2/1 grade', async () => {
      renderAt('season');

      const health = await screen.findByTestId('season-health');
      expect(health.textContent).toBe('Season health: 1 of 2 accepted episodes landed in their planned outcome range · 1 had no range planned');
      expect(vi.mocked(api.get).mock.calls.some(([url]) => url.includes('season-rhythm'))).toBe(false);
    });

    test('per slot, the plan beside the result and its ledger money; phase totals; the balance trend', async () => {
      renderAt('season');

      const one = await screen.findByTestId('insights-slot-1');
      expect(one.textContent).toContain('S1 · E1 · Gala Night');
      expect(one.textContent).toContain('Planned: Medium · pass to slay');
      expect(one.textContent).toContain('Actual: pass · High · 1 step above plan · in range');
      expect(one.textContent).toContain('Income 300 · spend 120 · net +180');
      expect(screen.getByTestId('insights-slot-4').textContent).toContain('Actual: not accepted yet');
      const phase = screen.getByTestId('insights-phase-1');
      expect(phase.textContent).toContain('Phase 1 · Foundation');
      expect(phase.textContent).toContain('6 slots with nothing planned yet');
      expect(screen.getByTestId('season-money').textContent).toContain('1,130');
      expect(screen.getByRole('img', { name: 'Balance trend from 1,000 to 1,130' })).toBeTruthy();
      expect(screen.getByTestId('planning-insights').textContent).toContain('2 between episodes');
    });
  });
});
