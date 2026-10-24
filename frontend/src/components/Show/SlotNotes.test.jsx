/**
 * Season Plan › a slot's panel (planner PR 3, 2026-10-24): the twists it
 * plants or pays off, its secrets, the relationships it needs; and the
 * pencil list ranked by fit.
 */
import { vi, describe, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SlotNotes, { rankedOptions } from './SlotNotes';

const NOTES = {
  twists: {
    plant: [{ id: 't1', title: 'The ring', characters: ['Jade', 'Dre'] }],
    payoff: [{ id: 't2', title: 'The list', planted_in: { episode_number: 2 } }],
  },
  reveals: [{ id: 'r1', intent: 'hint', character_name: 'Jade', text: 'She pawned the ring' }],
};
const NEED = {
  key: 'purpose:x', kind: 'purpose', title: 'Jade betrays Lala', a: { id: 'j', name: 'Jade' }, b: { id: 'l', name: 'Lala' },
  slot: { id: 'slot-4', slot_number: 4 }, state: 'missing', relationship: null, seed_why: 'Needed by E4: Jade betrays Lala',
};

describe('SlotNotes', () => {
  test("the slot's twists, secrets and the relationships it needs (only this slot's)", async () => {
    const api = { get: vi.fn(async () => ({ data: NOTES })), post: vi.fn() };
    render(<MemoryRouter><SlotNotes api={api} showId="s1" slot={{ id: 'slot-4', label: 'S1 · E4' }}
      needs={[NEED, { ...NEED, key: 'other', slot: { id: 'slot-9', slot_number: 9 } }]} /></MemoryRouter>);
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/s1/season/slots/slot-4/notes');
    const twists = await screen.findByTestId('slot-notes-twists');
    expect(twists.textContent).toContain('Plant The ring · Jade, Dre');
    expect(twists.textContent).toContain('Pay off The list · planted in E2');
    expect(screen.getByTestId('slot-notes-reveals').textContent).toContain('Hint Jade: She pawned the ring');
    const needs = screen.getByTestId('slot-notes-needs');
    expect(within(needs).getAllByRole('listitem')).toHaveLength(1);
    expect(within(needs).getByText('Missing')).toBeTruthy();
    expect(within(needs).getByRole('button', { name: 'Add a seed' })).toBeTruthy();
  });

  test('nothing planned there: nothing shown', async () => {
    const api = { get: vi.fn(async () => ({ data: { twists: { plant: [], payoff: [] }, reveals: [] } })) };
    const { container } = render(<MemoryRouter><SlotNotes api={api} showId="s1" slot={{ id: 'slot-6', label: 'E6' }} /></MemoryRouter>);
    await vi.waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="slot-notes"]')).toBeNull();
  });

  test('rankedOptions: best fit first with its reason; the plain list when there is no ranking', () => {
    const available = [{ id: 'a', name: 'A Ball' }, { id: 'b', name: 'Brunch' }, { id: 'c', name: 'Coffee' }];
    const fit = [
      { id: 'c', name: 'Coffee', reason: 'Fits the planned pressure (Low)', reason_kind: 'boost' },
      { id: 'b', name: 'Brunch', reason: 'Close to the planned pressure (Medium, planned Low)' },
      { id: 'gone', name: 'Pencilled since', reason: 'x' },
    ];
    expect(rankedOptions(available, fit).map((o) => o.label)).toEqual([
      'Coffee · Fits the planned pressure (Low)', 'Brunch · Close to the planned pressure (Medium, planned Low)', 'A Ball',
    ]);
    expect(rankedOptions(available, null).map((o) => o.label)).toEqual(['A Ball', 'Brunch', 'Coffee']);
  });
});
