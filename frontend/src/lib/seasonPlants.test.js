import { describe, test, expect } from 'vitest';
import { plantsByEpisode, openWithoutPayoff, plantCounts, payoffChoices, payoffLine, isOpen } from './seasonPlants';

const s = (n) => ({ id: `sl${n}`, slot_number: n });
const SLOTS = [s(1), s(2), s(3), s(5)];
const P = (over) => ({ id: 'x', status: 'planted', plant: s(1), payoff: null, payoff_slot_id: null, ...over });

describe('seasonPlants', () => {
  test('groups by the planting episode, in season order, missing last', () => {
    const groups = plantsByEpisode(SLOTS, [P({ id: 'a', plant: s(3) }), P({ id: 'b', plant: null }), P({ id: 'c' }), P({ id: 'd' })]);
    expect(groups.map((g) => [g.slot?.slot_number ?? null, g.plants.map((p) => p.id)])).toEqual([[1, ['c', 'd']], [3, ['a']], [null, ['b']]]);
  });

  test('open, counts, choices and the payoff line', () => {
    const list = [P({ id: 'a' }), P({ id: 'b', payoff_slot_id: 'sl5', payoff: s(5) }), P({ id: 'c', status: 'paid_off', paid_off: s(3) }), P({ id: 'd', status: 'dropped' })];
    expect(openWithoutPayoff(list).map((t) => t.id)).toEqual(['a']);
    expect(plantCounts(list)).toEqual({ total: 3, open: 2, paidOff: 1, noPayoff: 1 });
    expect(isOpen(P({ status: 'planned' }))).toBe(true);
    expect(payoffChoices(SLOTS, P({ plant: s(2) })).map((x) => x.slot_number)).toEqual([3, 5]);
    expect(list.map(payoffLine)).toEqual(['No payoff planned yet', 'Planned to pay off in Episode 5', 'Paid off in Episode 3', 'Dropped — it will not pay off']);
  });
});
