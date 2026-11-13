/**
 * useOfferDecision + OfferDecisionDialog — Start Episode's explicit offer
 * decision (Evoni's ruling: an explicit decision, never forced acceptance).
 * A 409 OFFER_DECISION_REQUIRED opens the choice with the offer's name,
 * status and payment; the chosen decision is sent again; Cancel starts
 * nothing; nothing is chosen for the user; any other error passes through.
 */
import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import OfferDecisionDialog from './OfferDecisionDialog';
import useOfferDecision from '../hooks/useOfferDecision';

const required = () => Object.assign(new Error('Request failed with status code 409'), {
  response: {
    status: 409,
    data: {
      success: false,
      code: 'OFFER_DECISION_REQUIRED',
      error: 'This event\'s offer is not accepted yet.',
      opportunity: { id: 'opp-1', name: 'Spring Capsule', status: 'offered', payment_amount: 1200 },
    },
  },
});

function Harness({ send, onDone }) {
  const od = useOfferDecision();
  const start = () => od.run(send).then((res) => onDone({ res }), (err) => onDone({ err }));
  return (
    <>
      <button type="button" onClick={start}>Start</button>
      <OfferDecisionDialog pending={od.pending} busy={od.busy} onChoose={od.choose} onCancel={od.cancel} />
    </>
  );
}

describe('OfferDecisionDialog', () => {
  test('no 409: the start goes through once, with no decision, and nothing is asked', async () => {
    const send = vi.fn().mockResolvedValue({ data: { success: true } });
    const onDone = vi.fn();
    render(<Harness send={send} onDone={onDone} />);
    await act(async () => { fireEvent.click(screen.getByText('Start')); });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(undefined);
    expect(screen.queryByTestId('offer-decision')).toBeNull();
    expect(onDone).toHaveBeenCalledWith({ res: { data: { success: true } } });
  });

  test('409 OFFER_DECISION_REQUIRED shows the offer and four choices; none is taken by itself', async () => {
    const send = vi.fn().mockRejectedValueOnce(required());
    const onDone = vi.fn();
    render(<Harness send={send} onDone={onDone} />);
    await act(async () => { fireEvent.click(screen.getByText('Start')); });
    const offer = screen.getByTestId('offer-decision-offer');
    expect(offer.textContent).toContain('Spring Capsule');
    expect(offer.textContent).toContain('Offered');
    expect(offer.textContent).toContain('1,200 coins');
    for (const d of ['accept', 'negotiate', 'decline', 'proceed_unaccepted']) {
      expect(screen.getByTestId(`offer-decision-${d}`)).toBeTruthy();
    }
    expect(screen.getByText('Continue without accepting')).toBeTruthy();
    expect(send).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  test.each(['accept', 'negotiate', 'decline', 'proceed_unaccepted'])(
    "choosing '%s' sends the start again with that decision and closes",
    async (decision) => {
      const send = vi.fn().mockRejectedValueOnce(required()).mockResolvedValueOnce({ data: { success: true, decided: decision } });
      const onDone = vi.fn();
      render(<Harness send={send} onDone={onDone} />);
      await act(async () => { fireEvent.click(screen.getByText('Start')); });
      fireEvent.change(screen.getByTestId('offer-decision-reason'), { target: { value: '  The fee is too low  ' } });
      await act(async () => { fireEvent.click(screen.getByTestId(`offer-decision-${decision}`)); });
      // The decision, the offers it is about (the ones the 409 listed) and why (A1).
      expect(send).toHaveBeenNthCalledWith(2, decision, { offer_decision_opportunity_ids: ['opp-1'], offer_decision_reason: 'The fee is too low' });
      await waitFor(() => expect(onDone).toHaveBeenCalledWith({ res: { data: { success: true, decided: decision } } }));
      expect(screen.queryByTestId('offer-decision')).toBeNull();
    }
  );

  // A1 (Evoni, 2026-11-13): a reason is needed to decline or to continue without accepting.
  test.each(['decline', 'proceed_unaccepted'])("'%s' without a reason sends nothing and says a reason is needed", async (decision) => {
    const send = vi.fn().mockRejectedValueOnce(required()).mockResolvedValueOnce({ data: { success: true } });
    const onDone = vi.fn();
    render(<Harness send={send} onDone={onDone} />);
    await act(async () => { fireEvent.click(screen.getByText('Start')); });
    expect(screen.queryByTestId('offer-decision-reason-missing')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByTestId(`offer-decision-${decision}`)); });
    expect(send).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('offer-decision-reason-missing').getAttribute('role')).toBe('alert');
    expect(screen.getByTestId('offer-decision-reason').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(screen.getByTestId('offer-decision-reason'));
    // Only spaces is no reason.
    fireEvent.change(screen.getByTestId('offer-decision-reason'), { target: { value: '   ' } });
    await act(async () => { fireEvent.click(screen.getByTestId(`offer-decision-${decision}`)); });
    expect(send).toHaveBeenCalledTimes(1);
    // With one, it goes.
    fireEvent.change(screen.getByTestId('offer-decision-reason'), { target: { value: 'Not the right fit' } });
    expect(screen.queryByTestId('offer-decision-reason-missing')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByTestId(`offer-decision-${decision}`)); });
    expect(send).toHaveBeenNthCalledWith(2, decision, { offer_decision_opportunity_ids: ['opp-1'], offer_decision_reason: 'Not the right fit' });
  });

  test.each(['accept', 'negotiate'])("'%s' needs no reason: it is sent without one", async (decision) => {
    const send = vi.fn().mockRejectedValueOnce(required()).mockResolvedValueOnce({ data: { success: true } });
    render(<Harness send={send} onDone={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByText('Start')); });
    await act(async () => { fireEvent.click(screen.getByTestId(`offer-decision-${decision}`)); });
    expect(send).toHaveBeenNthCalledWith(2, decision, { offer_decision_opportunity_ids: ['opp-1'] });
  });

  // A decision is an admin's: someone who cannot make it is told so and offered no choice.
  test('someone who cannot decide sees why, and no Accept, Negotiate, Decline, Continue or reason field', async () => {
    const forEditor = required();
    forEditor.response.data.can_decide = false;
    const send = vi.fn().mockRejectedValueOnce(forEditor);
    const onDone = vi.fn();
    render(<Harness send={send} onDone={onDone} />);
    await act(async () => { fireEvent.click(screen.getByText('Start')); });
    expect(screen.getByText('This offer needs an admin')).toBeTruthy();
    expect(screen.getByTestId('offer-decision-admin-only').textContent).toMatch(/only an admin can accept it, negotiate, decline it or start the episode without it/);
    expect(screen.getByTestId('offer-decision-admin-only').textContent).toMatch(/The episode was not started/);
    for (const d of ['accept', 'negotiate', 'decline', 'proceed_unaccepted']) expect(screen.queryByTestId(`offer-decision-${d}`)).toBeNull();
    expect(screen.queryByTestId('offer-decision-reason')).toBeNull();
    // The offer is named, without its payment.
    expect(screen.getByTestId('offer-decision-offer').textContent).toContain('Spring Capsule');
    expect(screen.getByTestId('offer-decision-offer').textContent).not.toContain('1,200');
    // Close is the only action, focused, and starts nothing.
    const close = screen.getByTestId('offer-decision-cancel');
    expect(close.textContent).toBe('Close');
    expect(document.activeElement).toBe(close);
    await act(async () => { fireEvent.click(close); });
    expect(send).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0][0].err.offerDecisionCancelled).toBe(true);
    expect(screen.queryByTestId('offer-decision')).toBeNull();
  });

  test('an admin (can_decide true, or an answer that does not say) gets the choices', async () => {
    for (const flag of [true, undefined]) {
      const asked = required();
      if (flag !== undefined) asked.response.data.can_decide = flag;
      const send = vi.fn().mockRejectedValueOnce(asked);
      const { unmount } = render(<Harness send={send} onDone={vi.fn()} />);
      await act(async () => { fireEvent.click(screen.getByText('Start')); });
      expect(screen.getByTestId('offer-decision-accept')).toBeTruthy();
      expect(screen.queryByTestId('offer-decision-admin-only')).toBeNull();
      unmount();
    }
  });

  test('what was typed stays when a reason-less Decline is refused, and the field comes before the choices', async () => {
    const send = vi.fn().mockRejectedValueOnce(required());
    render(<Harness send={send} onDone={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByText('Start')); });
    const reason = screen.getByTestId('offer-decision-reason');
    expect(reason.compareDocumentPosition(screen.getByTestId('offer-decision-accept')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.change(reason, { target: { value: '  ' } });
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-decline')); });
    expect(reason.value).toBe('  ');
    expect(screen.getByTestId('offer-decision')).toBeTruthy();
  });

  test('every offer the server listed is named in the decision', async () => {
    const two = required();
    two.response.data.opportunities = [two.response.data.opportunity, { id: 'opp-2', name: 'Second', status: 'considering', payment_amount: 0 }];
    const send = vi.fn().mockRejectedValueOnce(two).mockResolvedValueOnce({ data: { success: true } });
    render(<Harness send={send} onDone={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByText('Start')); });
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-accept')); });
    expect(send).toHaveBeenNthCalledWith(2, 'accept', { offer_decision_opportunity_ids: ['opp-1', 'opp-2'] });
  });

  test('Cancel starts nothing: no second request, and the caller is told it was cancelled', async () => {
    const send = vi.fn().mockRejectedValueOnce(required());
    const onDone = vi.fn();
    render(<Harness send={send} onDone={onDone} />);
    await act(async () => { fireEvent.click(screen.getByText('Start')); });
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-cancel')); });
    expect(send).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0][0].err.offerDecisionCancelled).toBe(true);
    expect(screen.queryByTestId('offer-decision')).toBeNull();
  });

  test('any other error passes straight through without asking', async () => {
    const other = Object.assign(new Error('nope'), { response: { status: 409, data: { code: 'DEAL_PRICE_REQUIRED' } } });
    const send = vi.fn().mockRejectedValueOnce(other);
    const onDone = vi.fn();
    render(<Harness send={send} onDone={onDone} />);
    await act(async () => { fireEvent.click(screen.getByText('Start')); });
    expect(onDone).toHaveBeenCalledWith({ err: other });
    expect(screen.queryByTestId('offer-decision')).toBeNull();
  });
});
