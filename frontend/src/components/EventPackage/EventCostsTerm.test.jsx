/**
 * EventCostsTerm (deal build PR 4, Task #2365) — a deal event's itemised
 * costs in the Terms area: each row names who pays, drafted extras carry
 * their rule 14 note, rows are added and drafted through /costs, and a
 * locked event shows them read-only. A legacy event shows no Costs block.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EventCostsTerm from './EventCostsTerm';
import EventTermsSection from './EventTermsSection';

const COSTS = [
  { id: 'c1', kind: 'extras', label: 'Drinks', amount: 100, paid_by: 'lala' },
  { id: 'c2', kind: 'extras', label: 'Valet', amount: 70, paid_by: 'lala' },
  { id: 'c3', kind: 'accommodation', label: 'Hotel', amount: 400, paid_by: 'host' },
];
const DRAFTED = { c1: { key: 'drinks', amount: 100 }, c2: { key: 'valet', amount: 55 } };

const costsUrl = '/api/v1/world/show-1/events/ev-1/costs';

function mockGet(costs = COSTS, drafted = DRAFTED) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === costsUrl) return { data: { success: true, costs, drafted, deal: true, locked: false } };
    return { data: { success: true, deliverables: [] } };
  });
}

function renderCosts(props = {}) {
  const onToast = vi.fn();
  const onSaved = vi.fn(async () => {});
  render(<EventCostsTerm showId="show-1" eventId="ev-1" locked={false} refreshKey={0} onToast={onToast} onSaved={onSaved} {...props} />);
  return { onToast, onSaved };
}

describe('EventCostsTerm (Task #2365)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    mockGet();
  });

  test('lists each cost with who pays, the drafted note, and the totals', async () => {
    renderCosts();
    const row = await screen.findByTestId('terms-cost-c1');
    expect(within(row).getByText('Drinks')).toBeTruthy();
    expect(screen.getByTestId('terms-cost-payer-c1').textContent).toBe('Lala pays');
    expect(screen.getByTestId('terms-cost-note-c1').textContent).toBe('Auto-drafted · event extras');
    expect(screen.getByTestId('terms-cost-note-c2').textContent).toBe('Edited');
    expect(screen.queryByTestId('terms-cost-note-c3')).toBeNull();
    expect(screen.getByTestId('terms-cost-payer-c3').textContent).toBe('Comped by the host');
    expect(screen.getByTestId('terms-cost-totals').textContent).toBe('Lala pays 170 coins · comped 400');
  });

  test('adds a cost through the costs route', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, cost: { id: 'c9' } } });
    renderCosts();
    await screen.findByTestId('terms-cost-c1');

    fireEvent.click(screen.getByTestId('terms-cost-add'));
    fireEvent.change(screen.getByTestId('terms-cost-kind'), { target: { value: 'travel' } });
    fireEvent.change(screen.getByTestId('terms-cost-label'), { target: { value: 'Car to the venue' } });
    fireEvent.change(screen.getByTestId('terms-cost-amount'), { target: { value: '80' } });
    fireEvent.change(screen.getByTestId('terms-cost-paid-by'), { target: { value: 'brand' } });
    fireEvent.click(screen.getByTestId('terms-cost-save'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(costsUrl, {
      kind: 'travel', label: 'Car to the venue', amount: 80, paid_by: 'brand',
    }));
  });

  test('a bad amount is refused before any request', async () => {
    renderCosts();
    await screen.findByTestId('terms-cost-c1');
    fireEvent.click(screen.getByTestId('terms-cost-add'));
    fireEvent.change(screen.getByTestId('terms-cost-amount'), { target: { value: '2.5' } });
    fireEvent.click(screen.getByTestId('terms-cost-save'));
    expect(await screen.findByText(/whole number of coins/)).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  test('Draft entry posts to the draft route and reloads (extras are event spending since the split)', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, drafted: [{ id: 'c4' }], costs: COSTS } });
    const { onToast } = renderCosts();
    await screen.findByTestId('terms-cost-c1');
    fireEvent.click(screen.getByTestId('terms-costs-draft-extras'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${costsUrl}/draft-extras`, {}));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Drafted the entry line'));
  });

  test('a new cost cannot be of kind extras; an existing extras row keeps its kind', async () => {
    renderCosts();
    await screen.findByTestId('terms-cost-c1');
    fireEvent.click(screen.getByTestId('terms-cost-add'));
    const kinds = [...screen.getByTestId('terms-cost-kind').options].map((o) => o.value);
    expect(kinds).not.toContain('extras');
    expect(kinds).toContain('entry');
  });

  test('locked: read-only, with no add, draft, edit or remove', async () => {
    renderCosts({ locked: true });
    await screen.findByTestId('terms-cost-c1');
    expect(screen.queryByTestId('terms-cost-add')).toBeNull();
    expect(screen.queryByTestId('terms-costs-draft-extras')).toBeNull();
    expect(screen.queryByLabelText('Edit Drinks')).toBeNull();
    expect(screen.queryByLabelText('Remove Drinks')).toBeNull();
    expect(screen.getByText(/Locked at Start Episode/)).toBeTruthy();
  });

  test('the Terms area shows Costs for a deal event only', async () => {
    const props = { showId: 'show-1', eventId: 'ev-1', locked: false, putEvent: vi.fn(), onSaved: vi.fn(), onToast: vi.fn() };
    const { unmount } = render(<EventTermsSection {...props} event={{ id: 'ev-1', deal_type: 'self_funded' }} />);
    expect(await screen.findByTestId('terms-costs')).toBeTruthy();
    unmount();

    render(<EventTermsSection {...props} event={{ id: 'ev-1', deal_type: null, cost_coins: 100 }} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByTestId('terms-costs')).toBeNull();
  });
});
