/**
 * EventTermsSection — audit fixes: removes are undoable (Evoni, 2026-10-23:
 * undo instead of confirm; a deliverable Undo could not put back as it was
 * still asks first), a failed page refresh
 * after a save is not a failed save, a deliverables load failure is said
 * where the missing prices are, and the price inputs reach the page.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EventTermsSection, { REFRESH_FAILED_MESSAGE } from './EventTermsSection';
import { resetUndoStore } from './useUndo';

const LEGACY = {
  id: 'ev-1',
  restrictions: [{ type: 'exclusivity', description: 'No competing brands' }],
  is_paid: true, payment_amount: 1500,
};
// A paid-content deal: its deliverables are priced.
const DEAL = { id: 'ev-1', deal_components: ['paid_for_content'], restrictions: [] };
const DELIVERABLES = [{ id: 'd1', description: 'Reel', deliverable_type: 'pulse_video', fee: null, required: true, status: 'pending' }];
const COSTS = [{ id: 'c1', kind: 'travel', label: 'Car', amount: null, paid_by: 'lala' }];

function renderTerms(event, props = {}) {
  const putEvent = vi.fn(async () => ({ data: { success: true } }));
  const onSaved = vi.fn(async () => {});
  const onToast = vi.fn();
  render(<EventTermsSection showId="show-1" eventId="ev-1" event={event} locked={false} putEvent={putEvent} onSaved={onSaved} onToast={onToast} {...props} />);
  return { putEvent, onSaved, onToast };
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  resetUndoStore();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.endsWith('/costs')) return { data: { success: true, costs: COSTS, drafted: {} } };
    return { data: { success: true, deliverables: DELIVERABLES } };
  });
});

describe('EventTermsSection audit fixes', () => {
  test('removing a restriction is done at once with "Removed \'…\' · Undo"; Undo puts it back', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const { putEvent, onSaved } = renderTerms(LEGACY);
    fireEvent.click(await screen.findByLabelText('Remove No competing brands'));
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(putEvent).toHaveBeenCalledWith({ restrictions: [] }));
    const notice = await screen.findByTestId('terms-restriction-undo');
    expect(notice.textContent).toContain("Removed 'No competing brands'");
    expect(screen.getByTestId('terms-restriction-undo-region').getAttribute('role')).toBe('status');
    // The test's event still holds it (no reload here): saved back as it is, not twice.
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    await waitFor(() => expect(putEvent).toHaveBeenLastCalledWith({ restrictions: [{ type: 'exclusivity', description: 'No competing brands' }] }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId('terms-restriction-undo')).toBeNull());
    confirmSpy.mockRestore();
  });

  test('removing a deliverable is done at once; Undo adds it back with the same fields', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    renderTerms(DEAL);
    fireEvent.click(await screen.findByLabelText('Remove Reel'));
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/world/show-1/events/ev-1/deliverables/d1'));
    expect((await screen.findByTestId('terms-deliverable-undo')).textContent).toContain("Removed 'Reel'");
    fireEvent.click(screen.getByTestId('terms-deliverable-undo-undo'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/events/ev-1/deliverables', {
      description: 'Reel', deliverable_type: 'pulse_video', platform: null, due_date: null, required: true, owed_to: 'host', fee: null,
    }));
    confirmSpy.mockRestore();
  });

  test('a deliverable Undo could not put back as it was (fulfilment recorded) still asks first', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.endsWith('/costs')) return { data: { success: true, costs: COSTS, drafted: {} } };
      return { data: { success: true, deliverables: [{ ...DELIVERABLES[0], status: 'completed', completed_at: '2026-10-01T10:00:00Z' }] } };
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderTerms(DEAL);
    fireEvent.click(await screen.findByLabelText('Remove Reel'));
    expect(confirmSpy).toHaveBeenCalledWith('Remove the deliverable "Reel"?');
    expect(api.delete).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  test('a save that succeeds while the page refresh fails reads "couldn\'t refresh", not "Failed to save"', async () => {
    const onSaved = vi.fn().mockRejectedValue(new Error('reload failed'));
    const { onToast, putEvent } = renderTerms(LEGACY, { onSaved });
    fireEvent.click(await screen.findByLabelText('Remove No competing brands'));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith(REFRESH_FAILED_MESSAGE));
    expect(putEvent).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId('terms-restriction-undo')).toBeTruthy();
    expect(onToast.mock.calls.some(([m]) => /^Failed/.test(m))).toBe(false);
  });

  test('deliverables that fail to load are said where the missing prices are, with Try again', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.endsWith('/costs')) return { data: { success: true, costs: [], drafted: {} } };
      throw new Error('network');
    });
    renderTerms(DEAL);
    expect(await screen.findByTestId('terms-price-unchecked')).toBeTruthy();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.endsWith('/costs')) return { data: { success: true, costs: [], drafted: {} } };
      return { data: { success: true, deliverables: DELIVERABLES } };
    });
    fireEvent.click(screen.getByTestId('terms-deliverables-retry'));
    expect((await screen.findByTestId('terms-price-missing')).textContent).toContain('"Reel"');
    expect(screen.queryByTestId('terms-price-unchecked')).toBeNull();
  });

  test('the deliverable and cost rows reach onPriceInputsChange, for the readiness price gate', async () => {
    const onPriceInputsChange = vi.fn();
    renderTerms(DEAL, { onPriceInputsChange });
    await waitFor(() => expect(onPriceInputsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ deliverables: DELIVERABLES, costs: COSTS }),
    ));
  });
});
