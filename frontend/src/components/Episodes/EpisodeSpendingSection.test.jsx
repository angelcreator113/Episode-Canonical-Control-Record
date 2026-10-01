/**
 * Production → Money → Event spending (the event cost split ruling, Evoni
 * 2026-09-30; docs/EVENT_EPISODE_FLOW.md §8(cc)).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeSpendingSection, { spendingNote, buildSpendingBody } from './EpisodeSpendingSection';
import EpisodeMoneyTab from './EpisodeMoneyTab';

const URL = '/api/v1/world/show-1/episodes/ep-1/spending';

const LINES = [
  { id: 'l1', label: 'Drinks', quantity: 1, unit_price: 100, total: 100, source: 'extras', draft_state: 'auto_drafted' },
  { id: 'l2', label: 'Valet', quantity: 2, unit_price: 55, total: 110, source: 'extras', draft_state: 'edited' },
  { id: 'l3', label: 'Cocktails', quantity: 3, unit_price: 25, total: 75, source: null, draft_state: null },
];
const spending = (over = {}) => ({ lines: LINES, total: 285, editable: true, ...over });

const renderSection = (over = {}, onChanged = vi.fn().mockResolvedValue()) => {
  render(<EpisodeSpendingSection showId="show-1" episodeId="ep-1" spending={spending(over)} onChanged={onChanged} />);
  return onChanged;
};

describe('EpisodeSpendingSection', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
    vi.mocked(api.put).mockReset();
    vi.mocked(api.delete).mockReset();
    vi.mocked(api.get).mockReset();
  });

  test('lists each line as quantity × unit price with its total and rule 14 note', () => {
    renderSection();
    const drinks = screen.getByTestId('em-spending-line-l1');
    expect(drinks.textContent).toContain('1 × 100');
    expect(drinks.textContent).toContain('−100');
    expect(drinks.textContent).toContain('Auto-drafted · event extras');
    expect(screen.getByTestId('em-spending-line-l2').textContent).toContain('Edited');
    expect(screen.getByTestId('em-spending-total').textContent).toBe('Complete will charge 285 coins');
  });

  test('adds a line: quantity × unit price, then reloads', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    const onChanged = renderSection();
    fireEvent.click(screen.getByTestId('em-spending-add'));
    fireEvent.change(screen.getByTestId('em-spending-label'), { target: { value: 'Photo booth' } });
    fireEvent.change(screen.getByTestId('em-spending-quantity'), { target: { value: '2' } });
    fireEvent.change(screen.getByTestId('em-spending-unit-price'), { target: { value: '75' } });
    fireEvent.click(screen.getByTestId('em-spending-save'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(URL, { label: 'Photo booth', quantity: 2, unit_price: 75 }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  test('edits and removes a line', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    const onChanged = renderSection();
    fireEvent.click(screen.getByTestId('em-spending-edit-l1'));
    expect(screen.getByTestId('em-spending-label').value).toBe('Drinks');
    fireEvent.change(screen.getByTestId('em-spending-quantity'), { target: { value: '3' } });
    fireEvent.click(screen.getByTestId('em-spending-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`${URL}/l1`, { label: 'Drinks', quantity: 3, unit_price: 100 }));
    await waitFor(() => expect(screen.queryByTestId('em-spending-form')).toBeNull());

    fireEvent.click(screen.getByTestId('em-spending-remove-l3'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(`${URL}/l3`));
    expect(onChanged).toHaveBeenCalledTimes(2);
  });

  test('shows the server\'s refusal', async () => {
    vi.mocked(api.delete).mockRejectedValue({ response: { data: { error: 'This episode is complete.' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderSection();
    fireEvent.click(screen.getByTestId('em-spending-remove-l1'));
    expect((await screen.findByRole('alert')).textContent).toContain('This episode is complete.');
  });

  test('read-only once the episode is complete', () => {
    renderSection({ editable: false });
    expect(screen.queryByTestId('em-spending-add')).toBeNull();
    expect(screen.queryByTestId('em-spending-edit-l1')).toBeNull();
    expect(screen.getByText(/The episode is complete, so these lines are read-only/)).toBeTruthy();
    expect(screen.getByTestId('em-spending-total').textContent).toBe('Charged 285 coins');
  });

  test('empty states in plain words', () => {
    renderSection({ lines: [], total: 0 });
    expect(screen.getByText('No event spending yet. Add what Lala buys during the event.')).toBeTruthy();
  });
});

describe('spendingNote and buildSpendingBody', () => {
  test('notes', () => {
    expect(spendingNote({ draft_state: 'auto_drafted', source: 'carried' })).toBe('Auto-drafted · from the event\'s costs');
    expect(spendingNote({ draft_state: null, source: 'carried' })).toBe('From the event\'s costs');
    expect(spendingNote({ draft_state: null, source: null })).toBeNull();
  });

  test('validation', () => {
    expect(buildSpendingBody({ label: ' ', quantity: '1', unit_price: '5' }).error).toMatch(/Name the line/);
    expect(buildSpendingBody({ label: 'A', quantity: '0', unit_price: '5' }).error).toMatch(/Quantity/);
    expect(buildSpendingBody({ label: 'A', quantity: '1', unit_price: '' }).error).toMatch(/Unit price/);
    expect(buildSpendingBody({ label: 'A', quantity: '1', unit_price: '2.5' }).error).toMatch(/Unit price/);
    expect(buildSpendingBody({ label: ' A ', quantity: '4', unit_price: '0' })).toEqual({ body: { label: 'A', quantity: 4, unit_price: 0 } });
  });
});

describe('EpisodeMoneyTab with event spending', () => {
  test('renders the section from the Money view and reloads it after a write', async () => {
    const money = {
      episode_id: 'ep-1', show_id: 'show-1', balance: 1000, rows: [], net: 0,
      event: { id: 'ev-1', name: 'Gala' }, expected: [], spending: spending(),
    };
    vi.mocked(api.get).mockResolvedValue({ data: { data: money } });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    render(<EpisodeMoneyTab episode={{ id: 'ep-1' }} showId="show-1" />);
    expect(await screen.findByTestId('em-spending')).toBeTruthy();
    fireEvent.click(screen.getByTestId('em-spending-remove-l2'));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });
});
