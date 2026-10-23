/**
 * Season twists, 2nd round (2026-10-23): "Suggest twists" shows the AI's
 * drafts with a loading state and the error; each draft is kept (saved as
 * it is), edited in the form, or dropped; nothing saves without a click.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SeasonTwists from './SeasonTwists';
import { resetUndoStore } from '../EventPackage/useUndo';

const BASE = '/api/v1/world/show-1/season/twists';
const SLOTS = [
  { id: 'sl1', slot_number: 1, label: 'S1 · E1', episode: { id: 'e1', title: 'The Brunch' }, done: true },
  { id: 'sl2', slot_number: 2, label: 'S1 · E2', episode: null, story_purpose: 'Maren hides', done: false },
  { id: 'sl4', slot_number: 4, label: 'S1 · E4', episode: { id: 'e4', title: 'The Gala' }, done: false },
  { id: 'sl6', slot_number: 6, label: 'S1 · E6', episode: null, done: false },
];
const DATA = (more = {}) => ({ data: {
  arc: { id: 'a1', title: 'Soft Luxury', season_number: 1 },
  slots: SLOTS,
  threads: [{ id: 'th1', title: 'The money', status: 'open' }],
  characters: [{ id: 'c1', name: 'Maren' }, { id: 'c2', name: 'Mo' }],
  twists: [], warnings: [],
  ...more,
} });
const KEY = { title: 'The spare key', description: 'A key on Maren’s chain', plant_slot_id: 'sl2', payoff_slot_id: 'sl6', thread_ids: ['th1'], character_ids: ['c1', 'c2'] };
const LETTER = { title: 'The letter', description: 'Mo keeps a letter', plant_slot_id: null, payoff_slot_id: null, thread_ids: [], character_ids: [] };

let api;
let answer;
beforeEach(() => {
  api = { get: vi.fn().mockResolvedValue(DATA()), put: vi.fn(), delete: vi.fn(), post: vi.fn(() => answer) };
});
afterEach(() => resetUndoStore());

const suggest = async () => {
  render(<SeasonTwists showId="show-1" api={api} />);
  fireEvent.click(await screen.findByTestId('stw-suggest'));
};

describe('Suggest twists', () => {
  test('a loading state, then the drafts; nothing saved', async () => {
    let resolve;
    answer = new Promise((r) => { resolve = r; });
    await suggest();
    expect(api.post).toHaveBeenCalledWith(`${BASE}/suggest`);
    expect(screen.getByTestId('stw-suggest').textContent).toContain('Suggesting…');
    expect(screen.getByTestId('stw-suggest').disabled).toBe(true);
    expect(screen.getByTestId('stw-suggesting')).toBeTruthy();
    resolve({ data: { drafts: [KEY, LETTER] } });
    const drafts = within(await screen.findByTestId('stw-drafts'));
    expect(screen.queryByTestId('stw-suggesting')).toBeNull();
    expect(drafts.getByText('The spare key')).toBeTruthy();
    expect(drafts.getByText(/S1 · E2 · Maren hides/)).toBeTruthy();
    expect(drafts.getByText(/S1 · E6/)).toBeTruthy();
    expect(drafts.getByText('Thread: The money')).toBeTruthy();
    expect(drafts.getByText('Mo')).toBeTruthy();
    // With no plant episode it cannot be kept as it is, only edited.
    expect(drafts.getByText('Choose in Edit')).toBeTruthy();
    expect(drafts.getByRole('button', { name: 'Keep The letter' }).disabled).toBe(true);
    expect(api.put).not.toHaveBeenCalled();
  });

  test('Keep saves it through the twist list and takes it off the drafts', async () => {
    answer = Promise.resolve({ data: { drafts: [KEY, LETTER] } });
    api.put.mockResolvedValue(DATA({ twists: [{ ...KEY, id: 't9', status: 'planned', plant: SLOTS[1], payoff: SLOTS[3], planted_episode_id: null }] }));
    await suggest();
    fireEvent.click(await screen.findByRole('button', { name: 'Keep The spare key' }));
    expect(await screen.findByText('Kept “The spare key”.')).toBeTruthy();
    expect(api.put).toHaveBeenCalledWith(BASE, {
      title: 'The spare key', description: 'A key on Maren’s chain', plant_slot_id: 'sl2', payoff_slot_id: 'sl6', status: 'planned',
      thread_ids: ['th1'], character_ids: ['c1', 'c2'], note: '',
    });
    expect(screen.getByTestId('stw-twist-t9')).toBeTruthy();
    const drafts = within(screen.getByTestId('stw-drafts'));
    expect(drafts.queryByText('The spare key')).toBeNull();
    expect(drafts.getByText('The letter')).toBeTruthy();
  });

  test('Edit opens it in the form; adding it takes it off the drafts', async () => {
    answer = Promise.resolve({ data: { drafts: [LETTER] } });
    api.put.mockResolvedValue(DATA());
    await suggest();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit The letter before keeping it' }));
    const form = within(screen.getByTestId('stw-form'));
    expect(form.getByText('Edit the suggestion, then add it')).toBeTruthy();
    expect(form.getByLabelText('Title').value).toBe('The letter');
    expect(form.getByLabelText('What it is').value).toBe('Mo keeps a letter');
    fireEvent.change(form.getByLabelText('Planted in'), { target: { value: 'sl4' } });
    fireEvent.click(form.getByRole('button', { name: 'Add twist' }));
    expect(await screen.findByText('Twist added.')).toBeTruthy();
    expect(api.put).toHaveBeenCalledWith(BASE, expect.objectContaining({ title: 'The letter', plant_slot_id: 'sl4' }));
    expect(api.put.mock.calls[0][1]).not.toHaveProperty('draftKey');
    expect(screen.queryByTestId('stw-drafts')).toBeNull();
  });

  test('Drop discards it without a call', async () => {
    answer = Promise.resolve({ data: { drafts: [KEY] } });
    await suggest();
    fireEvent.click(await screen.findByRole('button', { name: 'Drop The spare key' }));
    expect(screen.queryByTestId('stw-drafts')).toBeNull();
    expect(api.put).not.toHaveBeenCalled();
  });

  test('the error message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.post.mockImplementation(() => Promise.reject({ response: { data: { error: 'AI daily budget exceeded. No twists were suggested.' } } }));
    await suggest();
    expect(await screen.findByText('AI daily budget exceeded. No twists were suggested.')).toBeTruthy();
    expect(screen.getByTestId('stw-suggest').textContent).toContain('Suggest twists');
    expect(screen.queryByTestId('stw-drafts')).toBeNull();
  });
});
