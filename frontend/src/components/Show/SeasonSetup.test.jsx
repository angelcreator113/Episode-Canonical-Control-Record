/**
 * Setting up a season (Evoni, 2026-10-24): the form and its split check,
 * the placement preview (move, leave out, put back, Save), the draft
 * preview (accept one, accept all, skip, what was left alone) and the
 * checklist (its steps, its actions, gone once all are done).
 */
import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import {
  SeasonSetupForm, SeasonPlacement, SeasonDraft, SeasonChecklist, setupSteps, splitProblem, splitRanges, defaultForm, formFromArc,
} from './SeasonSetup';

describe('the split', () => {
  test('three whole numbers, each at least 1, adding up to 24', () => {
    expect(splitProblem([8, 8, 8])).toBeNull();
    expect(splitProblem([6, 10, 8])).toBeNull();
    expect(splitProblem([8, 8, 7])).toBe('These add up to 23; the season has 24 episodes.');
    expect(splitProblem([0, 12, 12])).toBe('Each part needs at least one episode.');
    expect(splitProblem(['', 12, 12])).toBe('Each part takes a whole number of episodes.');
    expect(splitRanges([6, 10, 8])).toEqual(['E1–E6', 'E7–E16', 'E17–E24']);
  });
  test('defaults, and a season read back for Edit', () => {
    expect(defaultForm(1).title).toBe('Soft Luxury Ascension');
    expect(defaultForm(2)).toEqual(expect.objectContaining({ title: 'Season 2', tagline: '', split: [8, 8, 8] }));
    expect(formFromArc({ title: 'T', tagline: null, phases: [
      { title: 'A', tagline: 'a', episode_start: 1, episode_end: 6 },
      { title: 'B', episode_start: 7, episode_end: 16 },
      { title: 'C', episode_start: 17, episode_end: 24 },
    ] })).toEqual({ title: 'T', tagline: '', phases: [{ title: 'A', tagline: 'a' }, { title: 'B', tagline: '' }, { title: 'C', tagline: '' }], split: [6, 10, 8] });
  });
});

describe('Set up the season form', () => {
  test('sends the title, tagline, parts and split; the line shows each part’s episodes', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});
    render(<SeasonSetupForm seasonNumber={2} onSubmit={onSubmit} />);
    expect(screen.getByRole('heading', { name: /Set up Season 2/ })).toBeTruthy();
    fireEvent.change(screen.getByTestId('sst-title'), { target: { value: 'Velvet Season' } });
    fireEvent.change(screen.getByTestId('sst-tagline'), { target: { value: 'Her own room' } });
    fireEvent.change(screen.getByTestId('sst-part-title-2'), { target: { value: 'Rooms' } });
    fireEvent.change(screen.getByTestId('sst-split-1'), { target: { value: '6' } });
    expect(screen.getByTestId('sst-split-note').textContent).toBe('These add up to 22; the season has 24 episodes.');
    expect(screen.getByTestId('sst-submit').disabled).toBe(true);
    fireEvent.change(screen.getByTestId('sst-split-2'), { target: { value: '10' } });
    expect(screen.getByTestId('sst-split-note').textContent).toBe('24 episodes: E1–E6 · E7–E16 · E17–E24');
    fireEvent.click(screen.getByTestId('sst-submit'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      title: 'Velvet Season', tagline: 'Her own room',
      phases: [{ title: 'Foundation', tagline: 'Prove you belong' }, { title: 'Rooms', tagline: 'Climb the ladder' }, { title: 'Legacy', tagline: 'Become uncopyable' }],
      split: [6, 10, 8],
    }));
  });

  test('a part with no episodes, or no name, cannot be sent', () => {
    render(<SeasonSetupForm onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByTestId('sst-split-3'), { target: { value: '0' } });
    expect(screen.getByTestId('sst-split-note').textContent).toBe('Each part needs at least one episode.');
    fireEvent.change(screen.getByTestId('sst-split-3'), { target: { value: '8' } });
    fireEvent.change(screen.getByTestId('sst-part-title-3'), { target: { value: ' ' } });
    expect(screen.getByTestId('sst-missing').textContent).toBe('Part 3 needs a name.');
    expect(screen.getByTestId('sst-submit').disabled).toBe(true);
  });

  test('Edit: the server’s refusal is shown in the form, in words', async () => {
    const onSubmit = vi.fn().mockRejectedValue({ response: { data: { error: 'This split would move a started episode to another part: E7 ("The Gallery") has started in Part 2 (Rooms).' } } });
    render(<SeasonSetupForm mode="edit" seasonNumber={1} initial={{ ...defaultForm(1), split: [6, 10, 8] }} onSubmit={onSubmit} onCancel={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /Edit Season 1/ })).toBeTruthy();
    fireEvent.change(screen.getByTestId('sst-split-1'), { target: { value: '8' } });
    fireEvent.change(screen.getByTestId('sst-split-2'), { target: { value: '8' } });
    fireEvent.click(screen.getByTestId('sst-submit'));
    expect((await screen.findByTestId('sst-error')).textContent).toContain('E7 ("The Gallery") has started in Part 2');
  });
});

const PREVIEW = {
  season_number: 1,
  open_slots: [1, 2, 3, 4, 5].map((n) => ({ id: `s${n}`, slot_number: n, label: `S1 · E${n}`, phase: 1 })),
  items: [
    { slot_id: 's1', label: 'S1 · E1', kind: 'episode', episode: { id: 'ep1', title: 'First Made' }, event: { id: 'evA', name: 'The Brunch', event_date: '2026-01-01' }, why: 'Episode 1, in episode order' },
    { slot_id: 's2', label: 'S1 · E2', kind: 'event', episode: null, event: { id: 'ev1', name: 'Early Dated', event_date: '2026-11-02' }, why: 'Dated 2026-11-02, in date order' },
    { slot_id: 's3', label: 'S1 · E3', kind: 'event', episode: null, event: { id: 'ev2', name: 'Undated Gala', event_date: null }, why: 'Undated; Fits the planned pressure (High)' },
  ],
  left_over: [{ kind: 'event', event: { id: 'ev9', name: 'Too Many' } }],
};

describe('Use your events and episodes', () => {
  test('lists each slot’s episode or event and why; move, leave out, put back; Save sends the list', async () => {
    const api = { get: vi.fn().mockResolvedValue({ data: PREVIEW }), post: vi.fn().mockResolvedValue({ data: { placed: 2, episodes: 1, events: 1 } }) };
    const onSaved = vi.fn();
    render(<SeasonPlacement showId="show-1" api={api} onSaved={onSaved} onClose={vi.fn()} />);
    const first = within(await screen.findByTestId('sst-place-ep:ep1'));
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/show-1/season/placement');
    expect(first.getByText('First Made')).toBeTruthy();
    expect(first.getByText(/with The Brunch · 2026-01-01/)).toBeTruthy();
    expect(first.getByText('Episode 1, in episode order')).toBeTruthy();
    expect(screen.getByText(/no date/)).toBeTruthy();
    expect(screen.getByTestId('sst-left-over').textContent).toContain('Too Many');
    expect(api.post).not.toHaveBeenCalled();

    // Move "Early Dated" to E5: E1 and E3 are taken, so they are not offered.
    const move = screen.getByTestId('sst-move-ev:ev1');
    expect([...move.options].map((o) => o.textContent)).toEqual(['S1 · E2', 'S1 · E4', 'S1 · E5']);
    fireEvent.change(move, { target: { value: 's5' } });
    // Leave "Undated Gala" out, then put it back: it takes the first free slot.
    fireEvent.click(screen.getByTestId('sst-remove-ev:ev2'));
    expect(screen.queryByTestId('sst-place-ev:ev2')).toBeNull();
    fireEvent.click(within(screen.getByTestId('sst-removed')).getByRole('button', { name: 'Put Undated Gala back' }));
    expect(screen.getByTestId('sst-move-ev:ev2').value).toBe('s2');
    fireEvent.click(screen.getByTestId('sst-remove-ev:ev2'));

    fireEvent.click(screen.getByTestId('sst-place-save'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/season/placement', { items: [
      { slot_id: 's1', episode_id: 'ep1' },
      { slot_id: 's5', event_id: 'ev1' },
    ] }));
    expect(onSaved).toHaveBeenCalledWith('1 episode placed · 1 event pencilled');
  });

  test('a refused Save says why and keeps the list', async () => {
    const api = { get: vi.fn().mockResolvedValue({ data: PREVIEW }), post: vi.fn().mockRejectedValue({ response: { data: { error: '"Undated Gala" has started an episode or is archived' } } }) };
    render(<SeasonPlacement showId="show-1" api={api} onSaved={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByTestId('sst-place-save'));
    expect(await screen.findByText(/has started an episode or is archived/)).toBeTruthy();
    expect(screen.getByTestId('sst-place-ev:ev2')).toBeTruthy();
  });

  test('nothing to place', async () => {
    const api = { get: vi.fn().mockResolvedValue({ data: { items: [], open_slots: [], left_over: [] } }), post: vi.fn() };
    render(<SeasonPlacement showId="show-1" api={api} onSaved={vi.fn()} onClose={vi.fn()} />);
    expect((await screen.findByTestId('sst-place-empty')).textContent).toContain('Nothing to place');
    expect(screen.queryByTestId('sst-place-save')).toBeNull();
  });
});

const DRAFTS = {
  drafts: [
    { slot_id: 's2', slot_number: 2, phase: 1, story_purpose: 'Lala finds the invitation', desired_pressure: 'High', story_thread_id: 't1', story_thread_title: 'Who sent it?' },
    { slot_id: 's5', slot_number: 5, phase: 1, story_purpose: 'The gala aftermath', desired_pressure: 'Low', story_thread_id: null, story_thread_title: null, current_purpose: 'old' },
    { slot_id: 's6', slot_number: 6, phase: 1, story_purpose: 'A quiet week', desired_pressure: null, story_thread_id: null },
  ],
  skipped: [{ slot_number: 1, reason: 'started' }, { slot_number: 3, reason: 'edited' }],
  dropped_threads: 1,
};
const PHASES = [{ phase: 1, title: 'Doors' }, { phase: 2, title: 'Rooms' }, { phase: 3, title: 'Keys' }];

describe('Draft the season', () => {
  test('one call for the season or a part; the preview; accept one, skip one, accept the rest', async () => {
    const api = {
      post: vi.fn(async (url, body) => {
        if (url.endsWith('/season/draft')) return { data: DRAFTS };
        return { data: { saved: body.drafts.map((d) => Number(d.slot_id.slice(1))), skipped: [] } };
      }),
    };
    const onSaved = vi.fn();
    render(<SeasonDraft showId="show-1" api={api} phases={PHASES} onSaved={onSaved} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('sst-scope-2'));
    expect(screen.getByTestId('sst-draft-go').textContent).toContain('Draft Part 2: Rooms');
    fireEvent.click(screen.getByTestId('sst-draft-go'));
    await screen.findByTestId('sst-drafts');
    expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/season/draft', { phase: 2 });
    const e2 = within(screen.getByTestId('sst-draft-2'));
    expect(e2.getByText('Lala finds the invitation')).toBeTruthy();
    expect(e2.getByText('High pressure')).toBeTruthy();
    expect(e2.getByText('Thread: Who sent it?')).toBeTruthy();
    expect(within(screen.getByTestId('sst-draft-5')).getByText('Replaces an earlier draft')).toBeTruthy();
    expect(screen.getByTestId('sst-not-offered').textContent).toBe('Left alone: E1 (started), E3 (yours). 1 thread the AI named is not one of yours, so it was left off.');

    fireEvent.click(screen.getByRole('button', { name: 'Accept the draft for E2' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/season/draft/accept', {
      drafts: [{ slot_id: 's2', story_purpose: 'Lala finds the invitation', desired_pressure: 'High', story_thread_id: 't1' }],
    }));
    await waitFor(() => expect(screen.queryByTestId('sst-draft-2')).toBeNull());
    expect(screen.getByTestId('sst-draft-note').textContent).toBe('Saved E2.');
    fireEvent.click(screen.getByRole('button', { name: 'Skip the draft for E6' }));
    expect(screen.queryByTestId('sst-draft-6')).toBeNull();
    expect(screen.queryByTestId('sst-accept-all')).toBeNull(); // one left
    fireEvent.click(screen.getByRole('button', { name: 'Accept the draft for E5' }));
    await waitFor(() => expect(screen.getByText('Every draft is accepted or skipped.')).toBeTruthy());
    expect(onSaved).toHaveBeenCalledTimes(2);
  });

  test('Accept all sends every draft at once and says what was not saved', async () => {
    const api = {
      post: vi.fn(async (url) => (url.endsWith('/season/draft') ? { data: DRAFTS } : { data: { saved: [2, 6], skipped: [{ slot_number: 5, reason: 'edited' }] } })),
    };
    render(<SeasonDraft showId="show-1" api={api} phases={PHASES} onSaved={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('sst-draft-go'));
    expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/season/draft', {});
    fireEvent.click(await screen.findByTestId('sst-accept-all'));
    await waitFor(() => expect(api.post.mock.calls[1][1].drafts.map((d) => d.slot_id)).toEqual(['s2', 's5', 's6']));
    expect((await screen.findByTestId('sst-draft-note')).textContent).toBe('Saved E2, E6. Not saved: E5 (you edited it since).');
  });

  test('a refusal (budget, nothing to draft) is shown in the page', async () => {
    const api = { post: vi.fn().mockRejectedValue({ response: { data: { error: 'AI daily budget exceeded. Nothing was drafted.' } } }) };
    render(<SeasonDraft showId="show-1" api={api} phases={PHASES} onSaved={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('sst-draft-go'));
    expect((await screen.findByTestId('sst-draft-note')).textContent).toBe('AI daily budget exceeded. Nothing was drafted.');
  });
});

const slot = (n, extra = {}) => ({ id: `s${n}`, slot_number: n, locked: false, event: null, intention: {}, ...extra });
const roadmapWith = (slots, extra = {}) => ({ phases: [{ phase: 1, slots }], unslotted_episodes: [], available_events: [], ...extra });

describe('The setup checklist', () => {
  test('the steps from the season, its goals and threads', () => {
    const steps = setupSteps({
      roadmap: roadmapWith([slot(1, { locked: true }), slot(2, { intention: { story_purpose: 'x' } }), slot(3)], {
        unslotted_episodes: [{ id: 'e' }, { id: 'f' }], available_events: [{ id: 'v' }],
      }),
      goals: [{ status: 'completed' }],
      threads: [],
    });
    expect(steps.map((s) => [s.key, s.done, s.detail])).toEqual([
      ['setup', true, '3 slots in 3 parts'],
      ['place', false, '2 episodes not in a slot · 1 event not pencilled'],
      ['goals', false, 'No goal is active for this season'],
      ['threads', false, 'No story threads yet'],
      ['draft', false, '1 open slot with no purpose yet'],
    ]);
    // Events with no free slot left do not hold the step open.
    const full = setupSteps({ roadmap: roadmapWith([slot(1, { event: { id: 'v1' }, intention: { story_purpose: 'x' } })], { available_events: [{ id: 'v2' }] }), goals: [], threads: [] });
    expect(full.find((s) => s.key === 'place').done).toBe(true);
  });

  test('each step has its action; partly done shows the count', () => {
    const steps = setupSteps({ roadmap: roadmapWith([slot(1)]), goals: [{ status: 'active' }], threads: [] });
    const actions = { place: { label: 'Place them', onClick: vi.fn() }, threads: { label: 'Add a thread', onClick: vi.fn() } };
    render(<SeasonChecklist steps={steps} actions={actions} />);
    expect(screen.getByTestId('sst-check-count').textContent).toBe('3 of 5 done');
    expect(screen.getByTestId('sst-step-goals').className).toContain('is-done');
    fireEvent.click(screen.getByTestId('sst-step-action-threads'));
    expect(actions.threads.onClick).toHaveBeenCalled();
  });

  test('folds away once every step is done', () => {
    const steps = setupSteps({
      roadmap: roadmapWith([slot(1, { intention: { story_purpose: 'x' } })]),
      goals: [{ status: 'paused' }], threads: [{ id: 't' }],
    });
    const { container } = render(<SeasonChecklist steps={steps} />);
    expect(steps.every((s) => s.done)).toBe(true);
    expect(container.innerHTML).toBe('');
  });
});
