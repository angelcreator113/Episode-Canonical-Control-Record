/**
 * Season Plan › Season twists (2026-10-23): each twist with its plant and
 * payoff episodes, its status and what is wrong with it; add one (the payoff
 * only after the plant); edit; delete with Undo; the empty state; nothing
 * without a season.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import SeasonTwists from './SeasonTwists';
import { resetUndoStore } from '../EventPackage/useUndo';

const BASE = '/api/v1/world/show-1/season/twists';
const SLOTS = [
  { id: 'sl1', slot_number: 1, label: 'S1 · E1', episode: { id: 'e1', title: 'The Brunch' }, done: true },
  { id: 'sl2', slot_number: 2, label: 'S1 · E2', episode: null, story_purpose: 'Maren hides', done: false },
  { id: 'sl4', slot_number: 4, label: 'S1 · E4', episode: { id: 'e4', title: 'The Gala' }, done: false },
  { id: 'sl6', slot_number: 6, label: 'S1 · E6', episode: null, done: false },
];
const slot = (id) => { const s = SLOTS.find((x) => x.id === id); return { id: s.id, slot_number: s.slot_number, label: s.label, episode: s.episode, done: s.done }; };
const RING = {
  id: 't1', title: 'The ring', description: 'Maren is not wearing it', status: 'planted', note: null,
  plant_slot_id: 'sl1', payoff_slot_id: 'sl4', plant: slot('sl1'), payoff: slot('sl4'),
  thread_ids: ['th1'], character_ids: ['c1'], planted_episode_id: 'e1', paid_off_episode_id: null,
};
const RENT = {
  id: 't2', title: 'The rent', description: null, status: 'planned', note: null,
  plant_slot_id: 'gone', payoff_slot_id: 'sl6', plant: null, payoff: slot('sl6'),
  thread_ids: [], character_ids: [], planted_episode_id: null, paid_off_episode_id: null,
};
const DATA = (more = {}) => ({ data: {
  arc: { id: 'a1', title: 'Soft Luxury', season_number: 1 },
  slots: SLOTS,
  threads: [{ id: 'th1', title: 'The money', status: 'open' }],
  characters: [{ id: 'c1', name: 'Maren' }, { id: 'c2', name: 'Mo' }],
  twists: [RING, RENT],
  warnings: [{ twist_id: 't2', text: '"The rent" is paid off in S1 · E6 with no plant: its plant episode is no longer in the season.' }],
  ...more,
} });

let api;
beforeEach(() => {
  api = { get: vi.fn().mockResolvedValue(DATA()), put: vi.fn(), delete: vi.fn(), post: vi.fn() };
});
afterEach(() => resetUndoStore());

describe('Season twists', () => {
  test('each twist: plant → payoff, status, links, warnings', async () => {
    render(<SeasonTwists showId="show-1" api={api} />);
    const ring = within(await screen.findByTestId('stw-twist-t1'));
    expect(api.get).toHaveBeenCalledWith(BASE);
    expect(ring.getByText('Planted')).toBeTruthy();
    expect(ring.getByText(/S1 · E1 · The Brunch/)).toBeTruthy();
    expect(ring.getByText(/S1 · E4 · The Gala/)).toBeTruthy();
    expect(ring.getByText('Thread: The money')).toBeTruthy();
    expect(ring.getByText('Maren')).toBeTruthy();
    expect(ring.queryByText(/no plant/)).toBeNull();
    const rent = within(screen.getByTestId('stw-twist-t2'));
    expect(rent.getByText('Planned')).toBeTruthy();
    expect(rent.getByText('Episode missing')).toBeTruthy();
    expect(rent.getByText(/with no plant/)).toBeTruthy();
  });

  test('add a twist; the payoff offers only later episodes', async () => {
    api.put.mockResolvedValue(DATA({ warnings: [] }));
    render(<SeasonTwists showId="show-1" api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: /Add a twist/ }));
    const form = within(screen.getByTestId('stw-form'));
    // A done episode is not offered for a new plant.
    expect([...form.getByLabelText('Planted in').options].map((o) => o.value)).toEqual(['', 'sl2', 'sl4', 'sl6']);
    fireEvent.change(form.getByLabelText('Title'), { target: { value: 'The letter' } });
    fireEvent.change(form.getByLabelText('What it is'), { target: { value: 'Mo keeps a letter' } });
    fireEvent.change(form.getByLabelText('Planted in'), { target: { value: 'sl4' } });
    expect([...form.getByLabelText('Paid off in').options].map((o) => o.value)).toEqual(['', 'sl6']);
    fireEvent.change(form.getByLabelText('Paid off in'), { target: { value: 'sl6' } });
    fireEvent.click(form.getByLabelText('The money'));
    fireEvent.click(form.getByLabelText('Mo'));
    expect(form.queryByLabelText('Status')).toBeNull();
    fireEvent.click(form.getByRole('button', { name: 'Add twist' }));
    expect(await screen.findByText('Twist added.')).toBeTruthy();
    expect(api.put).toHaveBeenCalledWith(BASE, {
      title: 'The letter', description: 'Mo keeps a letter', kind: 'twist', plant_beat: null, plant_slot_id: 'sl4', payoff_slot_id: 'sl6', status: 'planned',
      thread_ids: ['th1'], character_ids: ['c2'], note: '',
    });
    expect(screen.queryByTestId('stw-form')).toBeNull();
  });

  test('edit keeps a done plant episode and can mark it paid off; a refusal says so', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.put.mockRejectedValueOnce({ response: { data: { error: 'The payoff comes after the plant: choose a later episode to pay it off.' } } });
    render(<SeasonTwists showId="show-1" api={api} />);
    fireEvent.click(within(await screen.findByTestId('stw-twist-t1')).getByRole('button', { name: 'Edit The ring' }));
    const form = within(screen.getByTestId('stw-form'));
    expect(form.getByLabelText('Planted in').value).toBe('sl1');
    expect(form.getByLabelText('Title').value).toBe('The ring');
    fireEvent.change(form.getByLabelText('Status'), { target: { value: 'paid_off' } });
    fireEvent.click(form.getByRole('button', { name: 'Save twist' }));
    expect(await screen.findByText(/payoff comes after the plant/)).toBeTruthy();
    expect(api.put).toHaveBeenCalledWith(`${BASE}/t1`, expect.objectContaining({ status: 'paid_off', plant_slot_id: 'sl1', payoff_slot_id: 'sl4' }));
  });

  test('delete is done at once, with Undo', async () => {
    api.delete.mockResolvedValueOnce(DATA({ twists: [RENT] }));
    api.post.mockResolvedValueOnce(DATA());
    render(<SeasonTwists showId="show-1" api={api} />);
    fireEvent.click(within(await screen.findByTestId('stw-twist-t1')).getByRole('button', { name: 'Delete The ring' }));
    await waitFor(() => expect(screen.queryByTestId('stw-twist-t1')).toBeNull());
    expect(api.delete).toHaveBeenCalledWith(`${BASE}/t1`);
    expect(screen.getByTestId('stw-undo').textContent).toContain('Deleted “The ring”');
    fireEvent.click(screen.getByTestId('stw-undo-undo'));
    expect(await screen.findByTestId('stw-twist-t1')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith(`${BASE}/t1/restore`);
  });

  test('the empty state; no season shows nothing', async () => {
    api.get.mockResolvedValueOnce(DATA({ twists: [], warnings: [] }));
    const { unmount } = render(<SeasonTwists showId="show-1" api={api} />);
    expect((await screen.findByTestId('stw-empty')).textContent).toBe('No twists yet — plant one in an episode and pay it off later.');
    unmount();
    api.get.mockResolvedValueOnce({ data: { arc: null, slots: [], threads: [], characters: [], twists: [], warnings: [] } });
    const { container } = render(<SeasonTwists showId="show-1" api={api} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(container.textContent).toBe('');
  });
});
