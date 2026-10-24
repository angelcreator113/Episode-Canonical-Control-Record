/**
 * Season Plan › Relationships the season needs (planner PR 3, 2026-10-24):
 * the three states, the count of missing on the fold, "Add a seed" with its
 * why and needed-by slot, "Generate for this", and the pair's links.
 */
import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SeasonNeeds, { guessType, needsSummary, stateDetail, pairLink } from './SeasonNeeds';

const A = { id: 'c-lala', name: 'Lala' };
const M = { id: 'c-marcus', name: 'Marcus' };
const J = { id: 'c-jade', name: 'Jade' };
const NEEDS = {
  counts: { there: 1, seed: 1, missing: 1 },
  needs: [
    { key: 'twist:t1:c-jade|c-marcus', kind: 'twist', title: 'The ring', a: M, b: J, slot: { id: 'slot-4', slot_number: 4, label: 'S1 · E4' },
      state: 'seed', relationship: { id: 'r-seed', type: 'rival', seed_state: 'later' }, seed_why: 'Needed by E4: The ring' },
    { key: 'purpose:s5:c-jade|c-lala', kind: 'purpose', title: 'Jade betrays Lala at the launch', a: J, b: A, slot: { id: 'slot-5', slot_number: 5, label: 'S1 · E5' },
      state: 'missing', relationship: null, seed_why: 'Needed by E5: Jade betrays Lala at the launch' },
    { key: 'thread:th1:c-lala|c-marcus', kind: 'thread', title: 'The rent', a: A, b: M, slot: { id: 'slot-12', slot_number: 12, label: 'S1 · E12' },
      state: 'there', relationship: { id: 'r-1', type: 'love_interest', is_romantic: true, stage: 'flirting', tension_state: 'simmering' }, seed_why: 'Needed by E12: The rent' },
  ],
};

const renderNeeds = (props = {}) => render(<MemoryRouter><SeasonNeeds data={NEEDS} {...props} /></MemoryRouter>);

describe('Relationships the season needs', () => {
  test('a fold with the count of missing; each row there, seed only or missing, with the slot it is needed by', () => {
    renderNeeds({ api: { post: vi.fn() } });
    const card = screen.getByTestId('season-needs');
    expect(card.tagName).toBe('DETAILS');
    expect(screen.getByTestId('season-needs-count').textContent).toBe('1 missing');
    const seed = screen.getByTestId('need-twist:t1:c-jade|c-marcus');
    expect(within(seed).getByText('Seed only')).toBeTruthy();
    expect(within(seed).getByText('Needed by E4')).toBeTruthy();
    expect(within(seed).getByText('A rival seed, put off for later')).toBeTruthy();
    expect(within(seed).getByRole('link', { name: 'Open the seed' }).getAttribute('href')).toBe('/relationships?tab=candidates&char=c-marcus');

    const there = screen.getByTestId('need-thread:th1:c-lala|c-marcus');
    expect(within(there).getByText('There')).toBeTruthy();
    expect(within(there).getByText('love interest · romantic · now flirting · simmering')).toBeTruthy();
    expect(within(there).getByRole('link', { name: 'Open in Relationships' }).getAttribute('href')).toBe('/relationships?rel=r-1');
    expect(within(there).queryByRole('button', { name: 'Add a seed' })).toBeNull();

    const missing = screen.getByTestId('need-purpose:s5:c-jade|c-lala');
    expect(within(missing).getByText('Missing')).toBeTruthy();
    expect(within(missing).getByText('Jade betrays Lala at the launch')).toBeTruthy();
    expect(within(missing).getByRole('link', { name: 'Generate for this' }).getAttribute('href')).toBe('/relationships?gen_slot=slot-5');
  });

  test('"Add a seed" posts the pair, the chosen type, the why naming the need and the slot it is needed by', async () => {
    const api = { post: vi.fn(async () => ({ data: { candidates: [{ id: 'new' }], skipped: [] } })) };
    const onChanged = vi.fn();
    renderNeeds({ api, onChanged });
    const missing = screen.getByTestId('need-purpose:s5:c-jade|c-lala');
    fireEvent.click(within(missing).getByRole('button', { name: 'Add a seed' }));
    // "betrays" reads as a rivalry to start with; she can change it.
    const type = within(missing).getByLabelText('Type');
    expect(type.value).toBe('rival');
    fireEvent.change(type, { target: { value: 'friend' } });
    fireEvent.click(within(missing).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/relationships/seeds', {
      source: 'manual',
      seeds: [{ character_id_a: 'c-jade', character_id_b: 'c-lala', relationship_type: 'friend', is_romantic: false,
        seed_why: 'Needed by E5: Jade betrays Lala at the launch', needed_by_slot_id: 'slot-5' }],
    }));
    expect(await within(missing).findByText(/Seed added/)).toBeTruthy();
    expect(onChanged).toHaveBeenCalled();
  });

  test('a skipped seed says why; a failed load says so with Retry', async () => {
    const api = { post: vi.fn(async () => ({ data: { candidates: [], skipped: [{ why: 'They already have a relationship or seed.' }] } })) };
    const onRetry = vi.fn();
    const { unmount } = renderNeeds({ api });
    const missing = screen.getByTestId('need-purpose:s5:c-jade|c-lala');
    fireEvent.click(within(missing).getByRole('button', { name: 'Add a seed' }));
    fireEvent.click(within(missing).getByRole('button', { name: 'Add' }));
    expect(await within(missing).findByText('They already have a relationship or seed.')).toBeTruthy();
    unmount();
    renderNeeds({ data: null, error: 'Network Error', onRetry });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
    expect(screen.getByTestId('season-needs-count').textContent).toBe('none yet');
  });

  test('the helpers', () => {
    expect(guessType('They fall in love')).toBe('love_interest');
    expect(guessType('Sable confronts Dre')).toBe('rival');
    expect(guessType('Her mentor visits')).toBe('mentor');
    expect(guessType('Brunch')).toBe('friend');
    expect(needsSummary({ there: 2, seed: 0, missing: 0 })).toBe('all there');
    expect(needsSummary({ there: 0, seed: 2, missing: 0 })).toBe('2 seed only');
    expect(stateDetail({ state: 'missing' })).toBe('No relationship between them yet');
    expect(pairLink({ state: 'missing', a: { id: 'x' } })).toBe('/relationships?char=x');
  });
});
