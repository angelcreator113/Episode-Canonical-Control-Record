/**
 * EventTermsSection — "Price N items" (Evoni, 2026-10-23): with lines
 * reading "Price required", one button opens the first with its number
 * focused, and each save opens the next: a deliverable's fee, the deal's
 * fee components, then a cost Lala pays. Cancel ends it; a section
 * remounted mid-walk (the page's reloadTick) carries on.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EventTermsSection from './EventTermsSection';
import { resetUndoStore } from './useUndo';
import { setPriceWalk } from '../../utils/eventPriceWalk';

const EVENT = { id: 'ev-1', deal_components: ['paid_for_content', 'partnership_base'], partnership_base_fee: null, restrictions: [] };
const BASE = '/api/v1/world/show-1/events/ev-1';
let deliverables;
let costs;

function renderTerms(props = {}) {
  const putEvent = vi.fn(async () => ({ data: { success: true } }));
  const onSaved = vi.fn(async () => {});
  const onToast = vi.fn();
  const utils = render(<EventTermsSection showId="show-1" eventId="ev-1" event={EVENT} locked={false} putEvent={putEvent} onSaved={onSaved} onToast={onToast} {...props} />);
  return { putEvent, onSaved, onToast, ...utils };
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  resetUndoStore();
  setPriceWalk('ev-1', null);
  deliverables = [{ id: 'd1', description: 'Reel', deliverable_type: 'pulse_video', fee: null, required: true, status: 'pending' }];
  costs = [{ id: 'c1', kind: 'travel', label: 'Car', amount: null, paid_by: 'lala' }];
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `${BASE}/costs`) return { data: { success: true, costs, drafted: {} } };
    return { data: { success: true, deliverables } };
  });
  vi.mocked(api.put).mockImplementation(async (url, body) => {
    if (url === `${BASE}/deliverables/d1`) deliverables = deliverables.map((d) => (d.id === 'd1' ? { ...d, ...body } : d));
    if (url === `${BASE}/costs/c1`) costs = costs.map((c) => (c.id === 'c1' ? { ...c, ...body } : c));
    return { data: { success: true } };
  });
});

describe('EventTermsSection: Price N items', () => {
  test('walks every unpriced line in order, each number focused, one save at a time', async () => {
    const { putEvent, onToast } = renderTerms();
    const start = await screen.findByTestId('terms-price-all');
    expect(start.textContent.trim()).toBe('Price 3 items');

    fireEvent.click(start);
    // 1. The deliverable's fee.
    const fee = await screen.findByTestId('terms-deliverable-fee');
    await waitFor(() => expect(document.activeElement).toBe(fee));
    expect(screen.getByTestId('terms-price-walk-status').textContent).toContain('Pricing Reel');
    fireEvent.change(fee, { target: { value: '300' } });
    fireEvent.click(screen.getByTestId('terms-deliverable-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`${BASE}/deliverables/d1`, expect.objectContaining({ fee: 300 })));

    // 2. The partnership base.
    const base = await screen.findByTestId('terms-component-input-partnership_base_fee');
    await waitFor(() => expect(document.activeElement).toBe(base));
    expect(screen.queryByTestId('terms-deliverable-form')).toBeNull();
    fireEvent.change(base, { target: { value: '500' } });
    fireEvent.click(screen.getByTestId('terms-component-save-partnership_base_fee'));
    await waitFor(() => expect(putEvent).toHaveBeenCalledWith({ partnership_base_fee: 500 }));

    // 3. The cost Lala pays.
    const amount = await screen.findByTestId('terms-cost-amount');
    await waitFor(() => expect(document.activeElement).toBe(amount));
    fireEvent.change(amount, { target: { value: '40' } });
    fireEvent.click(screen.getByTestId('terms-cost-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`${BASE}/costs/c1`, expect.objectContaining({ amount: 40 })));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('That was the last price to set'));
    expect(screen.queryByTestId('terms-price-stop')).toBeNull();
  });

  test('Cancel on the open line ends the walk; Stop pricing does too', async () => {
    renderTerms();
    fireEvent.click(await screen.findByTestId('terms-price-all'));
    await screen.findByTestId('terms-deliverable-form');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('terms-deliverable-form')).toBeNull();
    expect(screen.queryByTestId('terms-price-stop')).toBeNull();
    expect(screen.getByTestId('terms-price-all')).toBeTruthy();

    fireEvent.click(screen.getByTestId('terms-price-all'));
    fireEvent.click(await screen.findByTestId('terms-price-stop'));
    expect(screen.getByTestId('terms-price-all')).toBeTruthy();
  });

  test('a section remounted mid-walk (the page\'s refresh) opens the line the walk is on', async () => {
    const { rerender, putEvent } = renderTerms();
    fireEvent.click(await screen.findByTestId('terms-price-all'));
    fireEvent.change(await screen.findByTestId('terms-deliverable-fee'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('terms-deliverable-save'));
    await screen.findByTestId('terms-component-input-partnership_base_fee');
    rerender(<EventTermsSection key="reload-1" showId="show-1" eventId="ev-1" event={EVENT} locked={false} putEvent={putEvent} onSaved={vi.fn()} onToast={vi.fn()} />);
    const base = await screen.findByTestId('terms-component-input-partnership_base_fee');
    await waitFor(() => expect(document.activeElement).toBe(base));
    expect(screen.getByTestId('terms-price-stop')).toBeTruthy();
  });

  test('no unpriced lines, or locked: no button', async () => {
    deliverables = [{ ...deliverables[0], fee: 100 }];
    costs = [{ ...costs[0], amount: 10 }];
    const { unmount } = renderTerms({ event: { ...EVENT, partnership_base_fee: 500 } });
    await screen.findByTestId('terms-deliverable-d1');
    await screen.findByTestId('terms-cost-c1');
    expect(screen.queryByTestId('terms-price-all')).toBeNull();
    unmount();
    renderTerms({ locked: true });
    await screen.findByTestId('terms-deliverable-d1');
    expect(screen.queryByTestId('terms-price-all')).toBeNull();
  });
});
