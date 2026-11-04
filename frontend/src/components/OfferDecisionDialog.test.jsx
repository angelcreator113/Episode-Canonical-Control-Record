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
      await act(async () => { fireEvent.click(screen.getByTestId(`offer-decision-${decision}`)); });
      expect(send).toHaveBeenNthCalledWith(2, decision);
      await waitFor(() => expect(onDone).toHaveBeenCalledWith({ res: { data: { success: true, decided: decision } } }));
      expect(screen.queryByTestId('offer-decision')).toBeNull();
    }
  );

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
