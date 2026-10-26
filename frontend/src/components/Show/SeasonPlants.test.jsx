/**
 * Season page › Plants (2026-10-25): every plant by episode, the open ones
 * with no payoff, the warnings for a plant open too long or past its
 * planned payoff, Mark paid off in episode N (with a note, and Undo), Not
 * paid off after all, Drop with Undo, the empty state and a failed load.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import SeasonPlants from './SeasonPlants';
import { resetUndoStore } from '../EventPackage/useUndo';

const BASE = '/api/v1/world/show-1/season/twists';
const SLOTS = [1, 2, 4, 6, 8].map((n) => ({ id: `sl${n}`, slot_number: n, label: `S1 · E${n}`, episode: n === 1 ? { id: 'e1', title: 'The Archive' } : null, done: n === 1 }));
const slot = (n) => { const s = SLOTS.find((x) => x.slot_number === n); return { id: s.id, slot_number: n, label: s.label, episode: s.episode }; };
const DECLAN = {
  id: 'p1', title: 'Declan Ferris is @thriftveil', description: 'He has been copying her archive.', kind: 'twist', plant_beat: 3,
  status: 'planted', plant_slot_id: 'sl1', payoff_slot_id: 'sl4', plant: slot(1), payoff: slot(4), paid_off: null, payoff_note: null,
  thread_ids: [], character_ids: [], note: null,
};
const SABLE = {
  id: 'p2', title: 'Studio by Sable wants Lala to model, not design', description: null, kind: 'opportunity', plant_beat: 14,
  status: 'planted', plant_slot_id: 'sl1', payoff_slot_id: null, plant: slot(1), payoff: null, paid_off: null, payoff_note: null,
  thread_ids: [], character_ids: [], note: null,
};
const RING = {
  id: 'p3', title: 'The ring', description: null, kind: 'mystery', plant_beat: null, status: 'paid_off', plant_slot_id: 'sl2',
  payoff_slot_id: 'sl6', plant: slot(2), payoff: slot(6), paid_off: slot(8), payoff_note: 'Maren gives it back.', thread_ids: [], character_ids: [], note: null,
};
const WARNINGS = [
  { twist_id: 'p1', type: 'past_payoff', text: '"Declan Ferris is @thriftveil" was meant to pay off in Episode 4, and the season is at Episode 6.' },
  { twist_id: 'p2', type: 'open_long', text: '"Studio by Sable wants Lala to model, not design" was planted in Episode 1 and is still open 5 episodes later.' },
];
const DATA = (more = {}) => ({ data: { arc: { id: 'a1', season_number: 1 }, slots: SLOTS, twists: [DECLAN, SABLE, RING], warnings: WARNINGS, current_episode: 6, ...more } });

let api;
beforeEach(() => {
  api = { get: vi.fn().mockResolvedValue(DATA()), put: vi.fn(), post: vi.fn(), delete: vi.fn() };
});
afterEach(() => resetUndoStore());

describe('SeasonPlants', () => {
  test('the timeline by episode, the counts, the open ones and the warnings', async () => {
    render(<SeasonPlants showId="show-1" api={api} />);
    expect((await screen.findByTestId('spl-summary')).textContent).toBe('3 plants · 2 open · 1 paid off · the season is at Episode 6');
    const ep1 = within(screen.getByTestId('spl-episode-1'));
    expect(ep1.getByText('Episode 1 · The Archive')).toBeTruthy();
    expect(ep1.getByText('Declan Ferris is @thriftveil')).toBeTruthy();
    expect(ep1.getByText('Planted in Episode 1, beat 3')).toBeTruthy();
    expect(ep1.getByText('Opportunity')).toBeTruthy();
    expect(screen.getByTestId('spl-payoff-p1').textContent).toBe('Planned to pay off in Episode 4');
    expect(screen.getByTestId('spl-payoff-p2').textContent).toBe('No payoff planned yet');
    expect(screen.getByTestId('spl-payoff-p3').textContent).toBe('Paid off in Episode 8 — Maren gives it back.');
    // Episode 2 comes after Episode 1.
    const order = screen.getAllByTestId(/^spl-episode-/).map((el) => el.dataset.testid);
    expect(order).toEqual(['spl-episode-1', 'spl-episode-2']);
    expect(within(screen.getByTestId('spl-open')).getByText('Studio by Sable wants Lala to model, not design')).toBeTruthy();
    const attention = within(screen.getByTestId('spl-attention'));
    expect(attention.getByText(/meant to pay off in Episode 4/)).toBeTruthy();
    expect(attention.getByText(/still open 5 episodes later/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark The ring paid off' })).toBeNull();
  });

  test('Mark paid off in episode N with a note, then Undo', async () => {
    const paid = { ...DECLAN, status: 'paid_off', paid_off: slot(6), payoff_note: 'Lala finds his login.' };
    api.post.mockResolvedValueOnce(DATA({ twists: [paid, SABLE, RING], warnings: [WARNINGS[1]] }));
    api.post.mockResolvedValueOnce(DATA());
    render(<SeasonPlants showId="show-1" api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Declan Ferris is @thriftveil paid off' }));
    const form = within(screen.getByTestId('spl-mark-form-p1'));
    // Every episode after the plant; the planned one chosen to start.
    const select = form.getByLabelText('Paid off in');
    expect([...select.options].map((o) => o.value)).toEqual(['', 'sl2', 'sl4', 'sl6', 'sl8']);
    expect(select.value).toBe('sl4');
    fireEvent.change(select, { target: { value: 'sl6' } });
    fireEvent.change(form.getByLabelText('How it paid off (optional)'), { target: { value: 'Lala finds his login.' } });
    fireEvent.click(form.getByRole('button', { name: 'Mark paid off' }));
    await waitFor(() => expect(screen.getByTestId('spl-payoff-p1').textContent).toBe('Paid off in Episode 6 — Lala finds his login.'));
    expect(api.post).toHaveBeenCalledWith(`${BASE}/p1/paid-off`, { slot_id: 'sl6', note: 'Lala finds his login.' });
    expect(screen.getByTestId('spl-undo').textContent).toContain('Marked “Declan Ferris is @thriftveil” paid off in Episode 6');
    fireEvent.click(screen.getByTestId('spl-undo-undo'));
    await waitFor(() => expect(screen.getByTestId('spl-payoff-p1').textContent).toBe('Planned to pay off in Episode 4'));
    expect(api.post).toHaveBeenLastCalledWith(`${BASE}/p1/reopen`);
  });

  test('a refusal says so; Not paid off after all reopens it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.post.mockRejectedValueOnce({ response: { data: { error: 'It was planted in Episode 1: choose a later episode for the payoff.' } } });
    render(<SeasonPlants showId="show-1" api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Studio by Sable wants Lala to model, not design paid off' }));
    const form = within(screen.getByTestId('spl-mark-form-p2'));
    expect(form.getByRole('button', { name: 'Mark paid off' }).disabled).toBe(true);
    fireEvent.change(form.getByLabelText('Paid off in'), { target: { value: 'sl2' } });
    fireEvent.click(form.getByRole('button', { name: 'Mark paid off' }));
    expect(await screen.findByText(/choose a later episode/)).toBeTruthy();

    api.post.mockResolvedValueOnce(DATA({ twists: [DECLAN, SABLE, { ...RING, status: 'planted', paid_off: null, payoff_note: null }] }));
    fireEvent.click(screen.getByRole('button', { name: 'The ring was not paid off after all' }));
    await waitFor(() => expect(screen.getByTestId('spl-payoff-p3').textContent).toBe('Planned to pay off in Episode 6'));
    expect(api.post).toHaveBeenLastCalledWith(`${BASE}/p3/reopen`);
  });

  test('Drop keeps everything else, with Undo', async () => {
    api.put.mockResolvedValueOnce(DATA({ twists: [DECLAN, { ...SABLE, status: 'dropped' }, RING], warnings: [WARNINGS[0]] }));
    api.put.mockResolvedValueOnce(DATA());
    render(<SeasonPlants showId="show-1" api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Drop Studio by Sable wants Lala to model, not design' }));
    await waitFor(() => expect(screen.getByTestId('spl-payoff-p2').textContent).toBe('Dropped — it will not pay off'));
    expect(api.put).toHaveBeenCalledWith(`${BASE}/p2`, {
      title: SABLE.title, description: '', kind: 'opportunity', plant_beat: 14, plant_slot_id: 'sl1', payoff_slot_id: '', status: 'dropped',
      thread_ids: [], character_ids: [], note: '',
    });
    fireEvent.click(screen.getByTestId('spl-undo-undo'));
    await waitFor(() => expect(screen.getByTestId('spl-payoff-p2').textContent).toBe('No payoff planned yet'));
    expect(api.put).toHaveBeenLastCalledWith(`${BASE}/p2`, expect.objectContaining({ status: 'planted' }));
  });

  test('the empty state, Add or edit plants, a failed load with Try again, and no season', async () => {
    const onAddPlants = vi.fn();
    api.get.mockResolvedValueOnce(DATA({ twists: [], warnings: [] }));
    const { unmount } = render(<SeasonPlants showId="show-1" api={api} onAddPlants={onAddPlants} />);
    expect((await screen.findByTestId('spl-empty')).textContent).toMatch(/Suggest plants from this script/);
    fireEvent.click(screen.getByTestId('spl-add'));
    expect(onAddPlants).toHaveBeenCalled();
    unmount();

    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.get.mockRejectedValueOnce(new Error('down'));
    const second = render(<SeasonPlants showId="show-1" api={api} />);
    expect(await screen.findByTestId('spl-failed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('spl-timeline')).toBeTruthy();
    second.unmount();

    api.get.mockResolvedValueOnce({ data: { arc: null, slots: [], twists: [], warnings: [] } });
    render(<SeasonPlants showId="show-1" api={api} />);
    expect(await screen.findByText(/Set up the season first/)).toBeTruthy();
  });
});
