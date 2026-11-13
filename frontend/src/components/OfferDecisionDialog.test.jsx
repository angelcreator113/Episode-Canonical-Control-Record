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

// A decision the server refuses (review of 2026-11-13): the dialog stays,
// what was typed stays, and nothing is sent again by itself.
describe('OfferDecisionDialog: a refused decision', () => {
  const refused = (status, code, error, opportunities) => Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { success: false, code, error, opportunities, opportunity: opportunities?.[0] || null } },
  });
  const FIRST = { id: 'opp-1', name: 'Spring Capsule', status: 'offered', payment_amount: 1200 };
  const LATER = { id: 'opp-2', name: 'Arrived Later', status: 'considering', payment_amount: 300 };
  const openWith = async (send, onDone = vi.fn()) => {
    render(<Harness send={send} onDone={onDone} />);
    await act(async () => { fireEvent.click(screen.getByText('Start')); });
    fireEvent.change(screen.getByTestId('offer-decision-reason'), { target: { value: 'The fee is too low' } });
    return onDone;
  };
  const choices = () => ['accept', 'negotiate', 'decline', 'proceed_unaccepted'].map((d) => screen.getByTestId(`offer-decision-${d}`));

  test('409: the dialog stays, the reason stays, it says the offer changed, and no choice can be sent until it is looked at', async () => {
    const stale = refused(409, 'OFFER_DECISION_STALE', 'The offers on this event are not the ones this decision was made about.', [FIRST, LATER]);
    const send = vi.fn().mockRejectedValueOnce(required()).mockRejectedValueOnce(stale).mockResolvedValueOnce({ data: { success: true } });
    const onDone = await openWith(send);
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-decline')); });
    expect(send).toHaveBeenCalledTimes(2);
    // Open, not settled, nothing retried.
    expect(screen.getByTestId('offer-decision')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    const alert = screen.getByTestId('offer-decision-changed');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('The offer information has changed since this opened. Nothing was started.');
    expect(alert.textContent).toContain('The offers on this event are not the ones this decision was made about.');
    expect(screen.getByTestId('offer-decision-reason').value).toBe('The fee is too low');
    // The old offer is still what is shown, and every choice waits.
    expect(screen.queryByTestId('offer-decision-offer-2')).toBeNull();
    for (const c of choices()) expect(c.disabled).toBe(true);
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-decline')); });
    expect(send).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(screen.getByTestId('offer-decision-refresh'));

    // Refresh shows what the refusal carried, and sends nothing.
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-refresh')); });
    expect(send).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('offer-decision-changed')).toBeNull();
    expect(screen.getByTestId('offer-decision-offer').textContent).toContain('Spring Capsule');
    expect(screen.getByTestId('offer-decision-offer-2').textContent).toContain('Arrived Later');
    expect(screen.getByTestId('offer-decision-offer-2').textContent).toContain('Considering');
    expect(screen.getByTestId('offer-decision-reason').value).toBe('The fee is too low');
    for (const c of choices()) expect(c.disabled).toBe(false);
    expect(onDone).not.toHaveBeenCalled();

    // A new, explicit choice: sent about the offers now shown, with the reason.
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-decline')); });
    expect(send).toHaveBeenNthCalledWith(3, 'decline', { offer_decision_opportunity_ids: ['opp-1', 'opp-2'], offer_decision_reason: 'The fee is too low' });
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ res: { data: { success: true } } }));
    expect(screen.queryByTestId('offer-decision')).toBeNull();
  });

  test('409 for a step that is no longer legal is handled the same way, with the server\'s words', async () => {
    const illegal = refused(409, 'OFFER_DECISION_ILLEGAL', '"Spring Capsule" is held; it cannot move to booked from there.', [{ ...FIRST, status: 'held' }]);
    const send = vi.fn().mockRejectedValueOnce(required()).mockRejectedValueOnce(illegal);
    await openWith(send);
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-accept')); });
    expect(screen.getByTestId('offer-decision-changed').textContent).toContain('it cannot move to booked from there');
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-refresh')); });
    expect(screen.getByTestId('offer-decision-offer').textContent).toContain('Held for beat 14');
    expect(send).toHaveBeenCalledTimes(2);
  });

  test('409 with no open offer left: refresh says so, and no choice can be sent', async () => {
    const send = vi.fn().mockRejectedValueOnce(required()).mockRejectedValueOnce(refused(409, 'OFFER_DECISION_STALE', 'Changed.', []));
    const onDone = await openWith(send);
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-accept')); });
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-refresh')); });
    expect(screen.getByTestId('offer-decision-none-left').textContent).toMatch(/no open offer to decide any more/);
    for (const c of choices()) expect(c.disabled).toBe(true);
    expect(screen.getByTestId('offer-decision-cancel').textContent).toBe('Close');
    expect(screen.getByTestId('offer-decision-reason').value).toBe('The fee is too low');
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-cancel')); });
    expect(onDone.mock.calls[0][0].err.offerDecisionCancelled).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  test('403: it says an admin decides, keeps the reason, and no choice can be sent', async () => {
    const forbidden = refused(403, 'OFFER_DECISION_FORBIDDEN', 'Only an admin can decide an offer. The episode was not started.', [FIRST]);
    const send = vi.fn().mockRejectedValueOnce(required()).mockRejectedValueOnce(forbidden);
    const onDone = await openWith(send);
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-decline')); });
    const alert = screen.getByTestId('offer-decision-forbidden');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('Only an admin can decide an offer. The episode was not started.');
    expect(alert.textContent).toContain('Your reason is still below');
    expect(screen.getByTestId('offer-decision-reason').value).toBe('The fee is too low');
    for (const c of choices()) expect(c.disabled).toBe(true);
    expect(screen.queryByTestId('offer-decision-refresh')).toBeNull();
    expect(screen.getByTestId('offer-decision-cancel').textContent).toBe('Close');
    expect(onDone).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(screen.getByTestId('offer-decision-reason'));
  });

  test('400: the server\'s words, the reason kept, and the choices as they were', async () => {
    const send = vi.fn().mockRejectedValueOnce(required())
      .mockRejectedValueOnce(refused(400, 'OFFER_REASON_REQUIRED', 'reason must be at most 500 characters.', [FIRST]))
      .mockResolvedValueOnce({ data: { success: true } });
    const onDone = await openWith(send);
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-decline')); });
    expect(screen.getByTestId('offer-decision-refused').textContent).toContain('reason must be at most 500 characters.');
    expect(screen.getByTestId('offer-decision-reason').value).toBe('The fee is too low');
    for (const c of choices()) expect(c.disabled).toBe(false);
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-decline')); });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(send).toHaveBeenCalledTimes(3);
  });

  // Security and error review of 2026-11-13: nothing that fails closes the
  // dialog by itself or loses what was typed, and nothing is sent again by itself.
  const UNEXPECTED = [
    ['the network', Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }), /Couldn't reach the server, so the episode may not have started/],
    ['a server error', Object.assign(new Error('500'), { response: { status: 500, data: { success: false, error: 'the database is unavailable' } } }), /The server could not start the episode: the database is unavailable/],
    ['a server error with no words', Object.assign(new Error('Request failed with status code 502'), { response: { status: 502, data: '' } }), /The server could not start the episode/],
    ['a refusal that is not about the offer', Object.assign(new Error('409'), { response: { status: 409, data: { code: 'DEAL_PRICE_REQUIRED', error: 'A deal price is missing.' } } }), /The episode was not started: A deal price is missing\./],
  ];
  test.each(UNEXPECTED)('%s: the dialog stays, the reason stays, it says what happened, and nothing is sent again', async (_name, failure, words) => {
    const send = vi.fn().mockRejectedValueOnce(required()).mockRejectedValueOnce(failure).mockResolvedValueOnce({ data: { success: true } });
    const onDone = await openWith(send);
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-decline')); });
    expect(send).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('offer-decision')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    const alert = screen.getByTestId('offer-decision-failed');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toMatch(words);
    expect(alert.textContent).toContain('Nothing was sent again. Your reason is still below.');
    expect(screen.getByTestId('offer-decision-reason').value).toBe('The fee is too low');
    // Still nothing sent, however long it sits there.
    await act(async () => { await Promise.resolve(); });
    expect(send).toHaveBeenCalledTimes(2);
    // Trying again is an explicit choice, with the same offers and reason.
    for (const c of choices()) expect(c.disabled).toBe(false);
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-decline')); });
    expect(send).toHaveBeenNthCalledWith(3, 'decline', { offer_decision_opportunity_ids: ['opp-1'], offer_decision_reason: 'The fee is too low' });
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ res: { data: { success: true } } }));
    expect(screen.queryByTestId('offer-decision')).toBeNull();
  });

  test('closing after such a failure hands that failure to the caller, which handles it as before', async () => {
    const other = Object.assign(new Error('409'), { response: { status: 409, data: { code: 'DEAL_PRICE_REQUIRED', error: 'A deal price is missing.' } } });
    const send = vi.fn().mockRejectedValueOnce(required()).mockRejectedValueOnce(other);
    const onDone = await openWith(send);
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-accept')); });
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-cancel')); });
    expect(onDone).toHaveBeenCalledWith({ err: other });
    expect(screen.queryByTestId('offer-decision')).toBeNull();
    expect(send).toHaveBeenCalledTimes(2);
  });

  test('a failure followed by a refusal about the offer: closing then is a plain cancel', async () => {
    const failure = Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });
    const stale = refused(409, 'OFFER_DECISION_STALE', 'Changed.', [FIRST]);
    const send = vi.fn().mockRejectedValueOnce(required()).mockRejectedValueOnce(failure).mockRejectedValueOnce(stale);
    const onDone = await openWith(send);
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-accept')); });
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-accept')); });
    expect(screen.getByTestId('offer-decision-changed')).toBeTruthy();
    expect(screen.queryByTestId('offer-decision-failed')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-cancel')); });
    expect(onDone.mock.calls[0][0].err.offerDecisionCancelled).toBe(true);
  });
});

describe('OfferDecisionDialog: keyboard', () => {
  const open = async (data = {}) => {
    const asked = required();
    Object.assign(asked.response.data, data);
    const send = vi.fn().mockRejectedValueOnce(asked).mockReturnValueOnce(new Promise(() => {}));
    const onDone = vi.fn();
    render(<Harness send={send} onDone={onDone} />);
    screen.getByText('Start').focus();
    await act(async () => { fireEvent.click(screen.getByText('Start')); });
    return { send, onDone };
  };
  const tab = (shiftKey = false) => fireEvent.keyDown(document.activeElement, { key: 'Tab', shiftKey });

  test('focus starts on the first choice, never on the close button', async () => {
    await open();
    expect(document.activeElement).toBe(screen.getByTestId('offer-decision-accept'));
  });

  test('Tab stays inside: forward from the last control goes to the first, back from the first to the last', async () => {
    await open();
    const first = screen.getByLabelText('Close');
    const last = screen.getByTestId('offer-decision-cancel');
    last.focus();
    tab();
    expect(document.activeElement).toBe(first);
    tab(true);
    expect(document.activeElement).toBe(last);
  });

  test('Escape closes, starts nothing, and focus goes back to the button that opened it', async () => {
    const { send, onDone } = await open();
    await act(async () => { fireEvent.keyDown(document.activeElement, { key: 'Escape' }); });
    expect(screen.queryByTestId('offer-decision')).toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0][0].err.offerDecisionCancelled).toBe(true);
    expect(document.activeElement).toBe(screen.getByText('Start'));
  });

  test('Escape does not close while a decision is being sent', async () => {
    const { onDone } = await open();
    await act(async () => { fireEvent.click(screen.getByTestId('offer-decision-accept')); });
    expect(screen.getByTestId('offer-decision-cancel').textContent).toBe('Starting…');
    await act(async () => { fireEvent.keyDown(screen.getByTestId('offer-decision'), { key: 'Escape' }); });
    expect(screen.getByTestId('offer-decision')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  test('typing a reason never moves the focus out of the field', async () => {
    await open();
    const field = screen.getByTestId('offer-decision-reason');
    field.focus();
    for (const value of ['T', 'Th', 'The']) {
      fireEvent.change(field, { target: { value } });
      expect(document.activeElement).toBe(field);
    }
  });

  test('for someone who cannot decide, focus is on Close and Tab stays between Close and the close button', async () => {
    await open({ can_decide: false });
    const close = screen.getByTestId('offer-decision-cancel');
    expect(document.activeElement).toBe(close);
    tab();
    expect(document.activeElement).toBe(screen.getByLabelText('Close'));
    tab(true);
    expect(document.activeElement).toBe(close);
  });
});
