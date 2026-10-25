/**
 * A roadmap slot card shows its release day from the show's release
 * schedule (Evoni, 2026-10-25), beside E#, and keeps its Moves chips.
 */
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SlotCard } from './SeasonPageRoadmap';

const slot = { id: 's3', slot_number: 3, phase: 1, state: 'needs_event', episode: null, event: null, intention: {} };
const wrap = (props) => render(<MemoryRouter><SlotCard slot={slot} showId="show-1" onOpen={vi.fn()} onIntention={vi.fn()} {...props} /></MemoryRouter>);

describe('SlotCard release day', () => {
  test('shows its Sunday, and the goals it moves', () => {
    wrap({ when: { text: 'Sun, Nov 15', source: 'schedule' }, moves: [{ id: 'g1', title: 'Get booked' }] });
    expect(screen.getByTestId('szn-slot-when-3').textContent).toBe('Sun, Nov 15');
    expect(screen.getByTestId('szn-slot-when-3').className).not.toContain('is-preview');
    expect(screen.getByTestId('szn-slot-moves-3')).toBeTruthy();
  });
  test('a preview is marked', () => {
    wrap({ when: { text: 'Would be Sun, Nov 15', source: 'preview' } });
    expect(screen.getByTestId('szn-slot-when-3').className).toContain('is-preview');
  });
  test('no schedule, no day', () => {
    wrap({});
    expect(screen.queryByTestId('szn-slot-when-3')).toBeNull();
  });
});
