/**
 * Story threads, the one threads list (SeasonThreads; Evoni, 2026-10-26:
 * "Let's let them open themselves on new threads and build the threads
 * list"): a self-opened thread is marked new with Undo and Keep; its plan
 * can be changed and made a season twist; waiting suggestions have Keep /
 * Merge into… / Drop; Left out keeps the reason; closed threads fold away.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import api from '../../services/api';
import SeasonThreads from './SeasonThreads';

const BASE = '/api/v1/world/show-1/season/threads';
const SLOTS = [3, 4, 5, 7, 9].map((n) => ({ id: `s${n}`, slot_number: n, label: `S1 · E${n}`, phase: n < 5 ? 1 : 2, done: n === 3 }));
const thread = (over) => ({
  id: 't1', title: 'Will Maison Belle book Lala again?', description: null, status: 'open', source: 'seed',
  origin: { kind: 'seed', label: 'From the Velour Gala\'s seeds' }, opened_at: '2026-10-26T10:00:00Z',
  opened_by_itself: true, seen: false, can_undo: true, why: 'Her first repeat client.', part: { phase: 1, title: 'Foundation' },
  notes: [], notes_count: 0, slots: [], plan: { carry: { id: 's4', slot_number: 4 }, payoff: { id: 's7', slot_number: 7 }, by: 'ai' }, twists: [],
  ...over,
});
const LIST = {
  needs_migration: false, unchecked_seeds: 0,
  season: { arc_id: 'a1', title: 'Season 1', season_number: 1, phases: [{ phase: 1, title: 'Foundation' }], slots: SLOTS },
  threads: [
    thread(),
    thread({ id: 't2', title: 'Who sent the anonymous invitation?', opened_by_itself: false, seen: true, can_undo: false, origin: { label: 'Added by you' }, why: null,
      notes: [{ key: 'n1', text: 'Someone at the gala knows', label: 'From the Velour Gala\'s seeds', at: '2026-10-26T10:00:00Z', can_undo: true }], notes_count: 1, slots: [{ slot_number: 5, label: 'S1 · E5' }] }),
    thread({ id: 't3', title: 'Did Mo forgive her?', status: 'closed', opened_by_itself: false, seen: true, can_undo: false, plan: null }),
  ],
  waiting: [
    { source: 'short_story', id: 'p1', index: null, title: 'Who sent that invitation?', note: 'Maren saw it', label: 'From a short story: After the Gala (E3)', suggest_into: 't2', why: null, part: null },
    { source: 'feed', id: 'p2', index: 0, title: 'Does @velour go public?', note: null, label: 'From the feed', suggest_into: null, why: 'A public rival.', part: null },
  ],
  left_out: [{ kind: 'thread', id: 't9', title: 'Maren sold the ring', label: 'From the Velour Gala\'s seeds', reason: 'Her ring secret is hidden in episodes.', undone: false }],
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: LIST });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('SeasonThreads', () => {
  test('a self-opened thread: where it came from, why, its part and plan; Undo and Keep', async () => {
    render(<SeasonThreads showId="show-1" season={2} />);
    const card = within(await screen.findByTestId('sth-thread-t1'));
    expect(api.get).toHaveBeenCalledWith(`${BASE}/inbox`, { params: { season: 2 } });
    expect(card.getByText('New · opened by itself')).toBeTruthy();
    expect(card.getByText('From the Velour Gala\'s seeds')).toBeTruthy();
    expect(card.getByText('Part 1: Foundation')).toBeTruthy();
    expect(card.getByText(/Her first repeat client/)).toBeTruthy();
    expect(card.getByText('Suggested plan')).toBeTruthy();
    expect(card.getByTestId('sth-carry').value).toBe('s4');
    expect(card.getByTestId('sth-payoff').value).toBe('s7');
    // A done slot is not offered.
    expect(within(card.getByTestId('sth-carry')).queryByText(/E3/)).toBeNull();
    fireEvent.click(card.getByTestId('sth-undo'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${BASE}/t1/undo`));
    fireEvent.click(await card.findByRole('button', { name: /^Keep$/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${BASE}/seen`, { thread_ids: ['t1'] }));
  });

  test('her own thread: no New, no Undo; its notes with Undo; the slots that continue it', async () => {
    render(<SeasonThreads showId="show-1" />);
    const card = within(await screen.findByTestId('sth-thread-t2'));
    expect(card.queryByText('New · opened by itself')).toBeNull();
    expect(card.queryByTestId('sth-undo')).toBeNull();
    expect(card.getByText('Continued in S1 · E5')).toBeTruthy();
    fireEvent.click(card.getByRole('button', { name: 'Undo the note: Someone at the gala knows' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${BASE}/t2/notes/n1/undo`));
  });

  test('the plan changes; "Make it a season twist" is prefilled from it', async () => {
    render(<SeasonThreads showId="show-1" />);
    const card = within(await screen.findByTestId('sth-thread-t1'));
    fireEvent.change(card.getByTestId('sth-payoff'), { target: { value: 's9' } });
    fireEvent.click(card.getByRole('button', { name: /Save plan/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`${BASE}/t1/plan`, { carry_slot_id: 's4', payoff_slot_id: 's9' }));
    fireEvent.click(await card.findByRole('button', { name: /Make it a season twist/ }));
    const form = within(card.getByTestId('sth-twist-form'));
    expect(form.getByDisplayValue('Will Maison Belle book Lala again?')).toBeTruthy();
    fireEvent.click(form.getByRole('button', { name: /Add the twist/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/season/twists', expect.objectContaining({
      title: 'Will Maison Belle book Lala again?', plant_slot_id: 's4', thread_ids: ['t1'],
    })));
  });

  test('waiting: Keep, Merge into… (the same storyline chosen already), Drop', async () => {
    render(<SeasonThreads showId="show-1" />);
    const story = within(await screen.findByTestId('sth-waiting-short_story'));
    expect(story.getByText(/same storyline as “Who sent the anonymous invitation\?”/)).toBeTruthy();
    fireEvent.click(story.getByRole('button', { name: /Merge/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${BASE}/suggestions/decide`, { source: 'short_story', id: 'p1', index: null, action: 'merge', into: 't2' }));
    const feed = within(screen.getByTestId('sth-waiting-feed'));
    expect(feed.getByText(/A public rival/)).toBeTruthy();
    fireEvent.click(feed.getByRole('button', { name: /Keep/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${BASE}/suggestions/decide`, { source: 'feed', id: 'p2', index: 0, action: 'keep', into: null }));
    fireEvent.click(feed.getByRole('button', { name: /Drop/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${BASE}/suggestions/decide`, expect.objectContaining({ action: 'drop' })));
  });

  test('left out, with the reason; closed folded away with Reopen; seeds not read yet', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { ...LIST, unchecked_seeds: 2 } });
    render(<SeasonThreads showId="show-1" />);
    const left = within(await screen.findByTestId('sth-left-out'));
    expect(left.getByText('Her ring secret is hidden in episodes.')).toBeTruthy();
    fireEvent.click(left.getByRole('button', { name: /Keep it after all/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${BASE}/t9/restore`));
    const closed = within(screen.getByTestId('sth-closed'));
    fireEvent.click(closed.getByRole('button', { name: /Reopen/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${BASE}/t3/reopen`));
    fireEvent.click(screen.getByRole('button', { name: /Read them now/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${BASE}/inbox/seeds`, {}, { timeout: 120000 }));
  });

  test('an error says so', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.post).mockRejectedValue({ response: { data: { error: 'You have already kept this thread. Close it instead.' } } });
    render(<SeasonThreads showId="show-1" />);
    fireEvent.click(within(await screen.findByTestId('sth-thread-t1')).getByTestId('sth-undo'));
    expect(await screen.findByText('You have already kept this thread. Close it instead.')).toBeTruthy();
  });
});
