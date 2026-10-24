/**
 * Seeds › when a seed is needed (planner PR 3, 2026-10-24): "Needed by E12"
 * on a seed made for a season slot, and "Back: E12 is next" on one back
 * from Later; the Season Plan's "Generate for this" link.
 */
import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CandidateView from './CandidateView';
import { genSlotLink } from '../../pages/RelationshipEngine';

const seed = (id, f = {}) => ({
  id, character_id_a: 'a', character_id_b: 'b', character_a_name: 'Jade', character_b_name: 'Dre',
  relationship_type: 'rival', confirmed: false, seed_source: 'manual', seed_why: 'Needed by E12: the betrayal lands', seed_state: null, ...f,
});
const handlers = { onConfirm: vi.fn(), onQuickConfirm: vi.fn(), onKeep: vi.fn(), onDismiss: vi.fn(), onBringBack: vi.fn(), onConfirmAll: vi.fn() };

describe('seed timing', () => {
  test('"Needed by E12" on the card; "Back: E12 is next" on one back from Later', () => {
    render(<MemoryRouter><CandidateView cands={[
      seed('s1', { needed_by: { slot_id: 'x', slot_number: 12, label: 'E12' } }),
      seed('s2', { character_a_name: 'Lala', needed_by: { slot_id: 'y', slot_number: 5, label: 'E5' }, back_from: 'later', back_note: 'Back: E5 is next' }),
      seed('s3', { character_a_name: 'Mo', seed_state: 'later', needed_by: { slot_id: 'z', slot_number: 20, label: 'E20' } }),
    ]} busy={null} {...handlers} /></MemoryRouter>);
    expect(screen.getByTestId('seed-needed-s1').textContent).toBe('Needed by E12');
    expect(screen.queryByTestId('seed-back-s1')).toBeNull();
    expect(screen.getByTestId('seed-needed-s2').textContent).toBe('Needed by E5');
    expect(screen.getByTestId('seed-back-s2').textContent.trim()).toBe('Back: E5 is next');
    // Two pending cards; the one still Later waits in its fold, and says when it is needed.
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Later · 1/ }));
    expect(within(screen.getByRole('region', { name: 'Later' })).getByText(/Needed by E20/)).toBeTruthy();
  });

  test('genSlotLink reads ?gen_slot= once and gives the address without it', () => {
    const id = 'aaaaaaaa-0000-4000-8000-000000000005';
    expect(genSlotLink(`?gen_slot=${id}`)).toEqual({ slot: id, search: '' });
    expect(genSlotLink(`?tab=candidates&gen_slot=${id}`)).toEqual({ slot: id, search: '?tab=candidates' });
    expect(genSlotLink('?gen_slot=nope')).toBeNull();
    expect(genSlotLink('?tab=list')).toBeNull();
  });
});
