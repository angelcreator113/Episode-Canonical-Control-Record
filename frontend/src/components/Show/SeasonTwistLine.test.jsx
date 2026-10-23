/**
 * Season Plan › Season twists › the season line (2026-10-23): each twist
 * drawn from its plant slot to its payoff slot, open to the end with no
 * payoff, backwards and orphaned ones marked; its ends in words for phone
 * width; the warnings beside it; dropped twists left off.
 */
import { describe, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import SeasonTwistLine, { twistSpan } from './SeasonTwistLine';

const SLOTS = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `sl${n}`, slot_number: n, label: `S1 · E${n}`, written: n === 4 }));
const at = (n) => ({ id: `sl${n}`, slot_number: n, label: `S1 · E${n}` });
const TWISTS = [
  { id: 't1', title: 'The ring', status: 'planted', plant: at(1), payoff: at(4) },
  { id: 't2', title: 'The rent', status: 'planned', plant: null, payoff: at(6) },
  { id: 't3', title: 'Backwards', status: 'planned', plant: at(5), payoff: at(2) },
  { id: 't4', title: 'The key', status: 'planned', plant: at(3), payoff: null },
  { id: 't5', title: 'Gone', status: 'dropped', plant: at(1), payoff: at(2) },
];
const WARNINGS = [
  { twist_id: 't2', text: '"The rent" is paid off in S1 · E6 with no plant: its plant episode is no longer in the season.' },
  { twist_id: 't3', text: '"Backwards" is paid off in S1 · E2, before it is planted in S1 · E5.' },
  { twist_id: 't1', text: 'Episode 4 is already written and doesn\'t pay off "The ring" yet.' },
  { twist_id: 't5', text: 'not shown' },
];

describe('twistSpan', () => {
  const indexOf = new Map(SLOTS.map((s, i) => [s.id, i]));
  test('plant to payoff, backwards, open, orphaned, nowhere', () => {
    expect(twistSpan(TWISTS[0], indexOf, 5)).toEqual({ from: 0, to: 3, kind: 'span' });
    expect(twistSpan(TWISTS[2], indexOf, 5)).toEqual({ from: 1, to: 4, kind: 'backwards' });
    expect(twistSpan(TWISTS[3], indexOf, 5)).toEqual({ from: 2, to: 5, kind: 'open' });
    expect(twistSpan(TWISTS[1], indexOf, 5)).toEqual({ from: 5, to: 5, kind: 'orphan' });
    expect(twistSpan({ plant: null, payoff: null }, indexOf, 5)).toBeNull();
  });
});

describe('SeasonTwistLine', () => {
  test('a row per live twist, drawn across the slots, its ends in words', () => {
    const { container } = render(<SeasonTwistLine slots={SLOTS} twists={TWISTS} warnings={WARNINGS} />);
    expect(container.querySelectorAll('.stl-tick')).toHaveLength(6);
    expect(container.querySelector('.stl-tick.is-written').textContent).toBe('4');
    expect(screen.queryByTestId('stw-line-t5')).toBeNull();
    const ring = screen.getByTestId('stw-line-t1');
    expect(ring.querySelector('.stl-bar').style.gridColumn).toBe('1 / 5');
    expect(ring.querySelector('.stl-bar').dataset.kind).toBe('span');
    expect(within(ring).getByTestId('stw-line-t1-ends').textContent).toBe('E1 → E4');
    expect(screen.getByTestId('stw-line-t3').querySelector('.stl-bar').dataset.kind).toBe('backwards');
    expect(screen.getByTestId('stw-line-t4').querySelector('.stl-bar').style.gridColumn).toBe('3 / 7');
    expect(screen.getByTestId('stw-line-t4-ends').textContent).toBe('E3 → not chosen');
    expect(screen.getByTestId('stw-line-t2-ends').textContent).toBe('no plant → E6');
  });

  test('the warnings beside it, each with its twist; none for a dropped one', () => {
    render(<SeasonTwistLine slots={SLOTS} twists={TWISTS} warnings={WARNINGS} />);
    const warns = screen.getAllByTestId('stw-line-warning').map((w) => w.textContent);
    expect(warns).toHaveLength(3);
    expect(warns).toContain('Episode 4 is already written and doesn\'t pay off "The ring" yet.');
    expect(warns.some((w) => w.includes('before it is planted'))).toBe(true);
    expect(warns.some((w) => w.includes('with no plant'))).toBe(true);
    expect(screen.queryByTestId('stw-line-ok')).toBeNull();
  });

  test('all well, or nothing to draw', () => {
    const { unmount } = render(<SeasonTwistLine slots={SLOTS} twists={[TWISTS[0]]} warnings={[]} />);
    expect(screen.getByTestId('stw-line-ok').textContent).toBe('Every twist is planted before it pays off.');
    unmount();
    const { container } = render(<SeasonTwistLine slots={SLOTS} twists={[]} warnings={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
