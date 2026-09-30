/**
 * The deal's performance bonus and Compensation (deal build PR 5; Q12,
 * EVENT_EPISODE_FLOW.md §8(cc)): a bonus is paid only when the accepted deal
 * contains one, for the tier it names; for a deal, the older is_paid /
 * payment_amount is not paid, so Compensation is read-only with a note.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EventTermsSection from './EventTermsSection';
import { describeBonusTerms, buildBonusTermsUpdate } from '../../utils/eventTerms';

const DEAL = { id: 'ev-1', deal_type: 'paid_appearance', appearance_fee: 450, bonus_terms: { slay: 200 } };

function renderTerms(event, props = {}) {
  const putEvent = vi.fn(async () => ({ data: { success: true } }));
  render(
    <EventTermsSection
      showId="show-1" eventId="ev-1" event={event} locked={false}
      putEvent={putEvent} onSaved={vi.fn(async () => {})} onToast={vi.fn()} {...props}
    />
  );
  return { putEvent };
}

describe('the performance bonus (deal build PR 5)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, deliverables: [], costs: [], drafted: {} } });
  });

  test('describes the bonus by tier, or says there is none', () => {
    expect(describeBonusTerms(DEAL)).toEqual({ set: true, label: 'SLAY 200 coins' });
    expect(describeBonusTerms({ bonus_terms: '{"slay":200,"pass":50}' }).label).toBe('SLAY 200 coins · PASS 50 coins');
    expect(describeBonusTerms({ bonus_terms: null }).set).toBe(false);
  });

  test('buildBonusTermsUpdate: whole coins, 1 or more; all empty is no bonus', () => {
    expect(buildBonusTermsUpdate({ slay: '200', pass: '', safe: '' })).toEqual({ body: { bonus_terms: { slay: 200 } } });
    expect(buildBonusTermsUpdate({ slay: '', pass: '', safe: '' })).toEqual({ body: { bonus_terms: null } });
    expect(buildBonusTermsUpdate({ slay: '0' }).error).toMatch(/SLAY/);
    expect(buildBonusTermsUpdate({ pass: '2.5' }).error).toMatch(/PASS/);
  });

  test('a cash deal shows its bonus and saves an edit through the event PUT', async () => {
    const { putEvent } = renderTerms(DEAL);
    expect(screen.getByTestId('terms-bonus-summary').textContent).toBe('SLAY 200 coins');

    fireEvent.click(screen.getByTestId('terms-bonus-edit'));
    fireEvent.change(screen.getByTestId('terms-bonus-input-pass'), { target: { value: '80' } });
    fireEvent.click(screen.getByTestId('terms-bonus-save'));
    await waitFor(() => expect(putEvent).toHaveBeenCalledWith({ bonus_terms: { slay: 200, pass: 80 } }));
  });

  test('a bad amount is refused before any save', () => {
    const { putEvent } = renderTerms(DEAL);
    fireEvent.click(screen.getByTestId('terms-bonus-edit'));
    fireEvent.change(screen.getByTestId('terms-bonus-input-safe'), { target: { value: '-5' } });
    fireEvent.click(screen.getByTestId('terms-bonus-save'));
    expect(screen.getByText(/SAFE: a whole number/)).toBeTruthy();
    expect(putEvent).not.toHaveBeenCalled();
  });

  test('locked: the bonus is read-only', () => {
    renderTerms(DEAL, { locked: true });
    expect(screen.getByTestId('terms-bonus-summary')).toBeTruthy();
    expect(screen.queryByTestId('terms-bonus-edit')).toBeNull();
  });

  test('a no-cash deal has no bonus; its Compensation is read-only with a note', () => {
    renderTerms({ id: 'ev-1', deal_type: 'self_funded', is_paid: true, payment_amount: 300 });
    expect(screen.queryByTestId('terms-bonus')).toBeNull();
    expect(screen.queryByTestId('terms-compensation-edit')).toBeNull();
    expect(screen.getByTestId('terms-compensation-note').textContent).toMatch(/this older payment is not paid/);
  });

  test('a legacy event keeps its Compensation editor', () => {
    renderTerms({ id: 'ev-1', deal_type: null, is_paid: true, payment_amount: 300 });
    expect(screen.getByTestId('terms-compensation-edit')).toBeTruthy();
    expect(screen.queryByTestId('terms-bonus')).toBeNull();
  });
});
