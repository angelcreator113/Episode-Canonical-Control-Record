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
import useOfferDecision, { startKey, payloadFingerprint, episodeFromReadiness } from '../hooks/useOfferDecision';

// Every request carries the attempt's Idempotency-Key (idempotency ruling of 2026-11-13).
const KEYED = { headers: { 'Idempotency-Key': expect.stringMatching(/^[\x21-\x7e]{1,200}$/) } };
const keyOf = (send, n) => send.mock.calls[n - 1][2].headers['Idempotency-Key'];

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

function Harness({ send, onDone, check }) {
  const od = useOfferDecision();
  const start = () => od.run(send, check ? { check } : undefined).then((res) => onDone({ res }), (err) => onDone({ err }));
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
    expect(send).toHaveBeenCalledWith(undefined, undefined, KEYED);
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
      expect(send).toHaveBeenNthCalledWith(2, decision, { offer_decision_opportunity_ids: ['opp-1'], offer_decision_reason: 'The fee is too low' }, KEYED);
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
    expect(send).toHaveBeenNthCalledWith(2, decision, { offer_decision_opportunity_ids: ['opp-1'], offer_decision_reason: 'Not the right fit' }, KEYED);
  });

  test.each(['accept', 'negotiate'])("'%s' needs no reason: it is sent without one", async (decision) => {
    const send = vi.fn().mockRejectedValueOnce(required()).mockResolvedValueOnce({ data: { success: true } });
    render(<Harness send={send} onDone={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByText('Start')); });
    await act(async () => { fireEvent.click(screen.getByTestId(`offer-decision-${decision}`)); });
    expect(send).toHaveBeenNthCalledWith(2, decision, { offer_decision_opportunity_ids: ['opp-1'] }, KEYED);
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
    expect(send).toHaveBeenNthCalledWith(2, 'accept', { offer_decision_opportunity_ids: ['opp-1', 'opp-2'] }, KEYED);
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
    expect(send).toHaveBeenNthCalledWith(3, 'decline', { offer_decision_opportunity_ids: ['opp-1', 'opp-2'], offer_decision_reason: 'The fee is too low' }, KEYED);
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
    expect(send).toHaveBeenNthCalledWith(3, 'decline', { offer_decision_opportunity_ids: ['opp-1'], offer_decision_reason: 'The fee is too low' }, KEYED);
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

// Idempotency and recovery (Evoni's ruling of 2026-11-13): the server's own
// Idempotency-Key for Start Episode, one per attempt and per thing sent.
describe('OfferDecisionDialog: the Idempotency-Key', () => {
  const failure = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });
  const open = async (send, props = {}) => {
    const onDone = vi.fn();
    render(<Harness send={send} onDone={onDone} {...props} />);
    await act(async () => { fireEvent.click(screen.getByText('Start')); });
    return onDone;
  };
  const type = (value) => fireEvent.change(screen.getByTestId('offer-decision-reason'), { target: { value } });
  const click = (id) => act(async () => { fireEvent.click(screen.getByTestId(id)); });

  test('startKey: the same attempt and payload give the same key; anything different gives another; all are keys the server accepts', () => {
    const payload = { decision: 'decline', opportunityIds: ['b', 'a'], reason: 'Too low' };
    expect(startKey('attempt-1', payload)).toBe(startKey('attempt-1', { ...payload }));
    // The order the offers are listed in is not a different payload.
    expect(startKey('attempt-1', payload)).toBe(startKey('attempt-1', { ...payload, opportunityIds: ['a', 'b'] }));
    const others = [
      startKey('attempt-2', payload),
      startKey('attempt-1', { ...payload, decision: 'accept' }),
      startKey('attempt-1', { ...payload, opportunityIds: ['a'] }),
      startKey('attempt-1', { ...payload, reason: 'Too low.' }),
      startKey('attempt-1'),
    ];
    for (const k of others) expect(k).not.toBe(startKey('attempt-1', payload));
    expect(new Set(others).size).toBe(others.length);
    for (const k of [startKey('attempt-1', payload), ...others, startKey('x'.repeat(36), { decision: 'decline', opportunityIds: [], reason: 'y'.repeat(500) })]) {
      expect(k).toMatch(/^[\x21-\x7e]{1,200}$/);
    }
    expect(payloadFingerprint({ a: 1 })).toMatch(/^[0-9a-f]{8}$/);
  });

  test('the same choice sent again after a failure carries the same key: it is not made anew', async () => {
    const send = vi.fn().mockRejectedValueOnce(required()).mockRejectedValueOnce(failure()).mockRejectedValueOnce(failure()).mockResolvedValueOnce({ data: { success: true, replayed: true } });
    const onDone = await open(send);
    type('The fee is too low');
    await click('offer-decision-decline');
    await click('offer-decision-decline');
    await click('offer-decision-decline');
    expect(send).toHaveBeenCalledTimes(4);
    expect(keyOf(send, 3)).toBe(keyOf(send, 2));
    expect(keyOf(send, 4)).toBe(keyOf(send, 2));
    // The server's replay (200, replayed) is the Start's own answer: it settles as a success.
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ res: { data: { success: true, replayed: true } } }));
    expect(screen.queryByTestId('offer-decision')).toBeNull();
  });

  test('a different decision, a different reason, or different offers each carry a different key', async () => {
    const stale = Object.assign(new Error('409'), { response: { status: 409, data: { code: 'OFFER_DECISION_STALE', error: 'Changed.', opportunities: [{ id: 'opp-1', name: 'Spring Capsule', status: 'offered' }, { id: 'opp-2', name: 'Later', status: 'offered' }] } } });
    const send = vi.fn().mockRejectedValueOnce(required())
      .mockRejectedValueOnce(failure()).mockRejectedValueOnce(failure()).mockRejectedValueOnce(failure()).mockRejectedValueOnce(stale).mockRejectedValueOnce(failure());
    await open(send);
    type('The fee is too low');
    await click('offer-decision-decline');            // 2: decline, reason A, offer 1
    await click('offer-decision-proceed_unaccepted'); // 3: another decision
    type('Another reason');
    await click('offer-decision-decline');            // 4: decline, reason B
    type('The fee is too low');
    await click('offer-decision-decline');            // 5: decline, reason A again: stale
    await click('offer-decision-refresh');
    await click('offer-decision-decline');            // 6: decline, reason A, offers 1 and 2
    expect(send).toHaveBeenCalledTimes(6);
    const keys = [1, 2, 3, 4, 5, 6].map((n) => keyOf(send, n));
    // The first request (no decision) has its own key too.
    expect(new Set([keys[0], keys[1], keys[2], keys[3], keys[5]]).size).toBe(5);
    // The same decision, offers and reason as the second request: the same key.
    expect(keys[4]).toBe(keys[1]);
    // Every key of this attempt shares the attempt's id.
    const attempt = keys[0].split('.')[0];
    for (const k of keys) expect(k.split('.')[0]).toBe(attempt);
  });

  test('a new Start attempt never reuses a key', async () => {
    const send = vi.fn().mockRejectedValue(required());
    const onDone = await open(send);
    await click('offer-decision-cancel');
    await act(async () => { fireEvent.click(screen.getByText('Start')); });
    expect(send).toHaveBeenCalledTimes(2);
    expect(keyOf(send, 2)).not.toBe(keyOf(send, 1));
    expect(keyOf(send, 2).split('.')[0]).not.toBe(keyOf(send, 1).split('.')[0]);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('OfferDecisionDialog: an event that already has an episode, and checking after a network failure', () => {
  const EPISODE = { id: 'ep-9', title: 'The Gala', episode_number: 3 };
  const hasEpisode = () => Object.assign(new Error('409'), {
    response: { status: 409, data: { success: false, code: 'EVENT_ALREADY_HAS_EPISODE', error: 'This event already started Episode 3 "The Gala" (ep-9). An event starts at most one episode.', episode: EPISODE } },
  });
  const network = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });
  const readiness = (blockers) => ({ data: { success: true, data: { ready: blockers.length === 0, blockers, warnings: [] } } });
  const open = async (send, check) => {
    const onDone = vi.fn();
    render(<Harness send={send} onDone={onDone} check={check} />);
    await act(async () => { fireEvent.click(screen.getByText('Start')); });
    fireEvent.change(screen.getByTestId('offer-decision-reason'), { target: { value: 'The fee is too low' } });
    return onDone;
  };
  const click = (id) => act(async () => { fireEvent.click(screen.getByTestId(id)); });
  const choices = () => ['accept', 'negotiate', 'decline', 'proceed_unaccepted'].map((d) => screen.getByTestId(`offer-decision-${d}`));

  test('episodeFromReadiness reads the episode from a start-readiness answer, or null', () => {
    expect(episodeFromReadiness(readiness([{ key: 'prices_missing' }, { key: 'episode_exists', episode: EPISODE }]))).toEqual(EPISODE);
    expect(episodeFromReadiness(readiness([{ key: 'prices_missing' }]))).toBeNull();
    expect(episodeFromReadiness(readiness([]))).toBeNull();
    expect(episodeFromReadiness(undefined)).toBeNull();
  });

  test('409 EVENT_ALREADY_HAS_EPISODE: it names the episode and links to it, and never says it was not started or that this request made it', async () => {
    const send = vi.fn().mockRejectedValueOnce(required()).mockRejectedValueOnce(hasEpisode());
    const onDone = await open(send);
    await click('offer-decision-decline');
    const box = screen.getByTestId('offer-decision-has-episode');
    expect(box.getAttribute('role')).toBe('alert');
    expect(box.textContent).toContain('This event already has an episode: Episode 3 “The Gala”.');
    expect(box.textContent).toContain('Nothing new was started, and no decision was sent again.');
    const all = screen.getByTestId('offer-decision').textContent;
    expect(all).not.toMatch(/was not started|could not start|went through|your (earlier )?request/i);
    expect(screen.queryByTestId('offer-decision-failed')).toBeNull();
    const link = screen.getByTestId('offer-decision-open-episode');
    expect(link.getAttribute('href')).toBe('/episodes/ep-9');
    expect(link.textContent).toBe('Open the episode');
    expect(document.activeElement).toBe(link);
    // No choice can be sent; the reason is still there; Close hands the refusal to the caller.
    for (const c of choices()) expect(c.disabled).toBe(true);
    await click('offer-decision-accept');
    expect(send).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('offer-decision-reason').value).toBe('The fee is too low');
    expect(screen.getByTestId('offer-decision-cancel').textContent).toBe('Close');
    expect(onDone).not.toHaveBeenCalled();
    await click('offer-decision-cancel');
    expect(onDone.mock.calls[0][0].err.response.data.code).toBe('EVENT_ALREADY_HAS_EPISODE');
  });

  test('an episode with no number or title is still named and linked', async () => {
    const bare = hasEpisode();
    bare.response.data.episode = { id: 'ep-1', title: null, episode_number: null };
    const send = vi.fn().mockRejectedValueOnce(required()).mockRejectedValueOnce(bare);
    await open(send);
    await click('offer-decision-accept');
    expect(screen.getByTestId('offer-decision-has-episode').textContent).toContain('This event already has an episode: an episode.');
    expect(screen.getByTestId('offer-decision-open-episode').getAttribute('href')).toBe('/episodes/ep-1');
  });

  test('a network failure offers Check episode status; checking is one read and no Start; it found an episode', async () => {
    const check = vi.fn().mockResolvedValue(readiness([{ key: 'episode_exists', episode: EPISODE }]));
    const send = vi.fn().mockRejectedValueOnce(required()).mockRejectedValueOnce(network());
    const onDone = await open(send, check);
    await click('offer-decision-decline');
    const failed = screen.getByTestId('offer-decision-failed');
    expect(failed.textContent).toContain('the episode may not have started');
    expect(failed.textContent).toContain('Check whether the episode started before you choose again.');
    expect(check).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByTestId('offer-decision-check'));
    await click('offer-decision-check');
    expect(check).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('offer-decision-failed')).toBeNull();
    expect(screen.getByTestId('offer-decision-has-episode').textContent).toContain('This event already has an episode: Episode 3 “The Gala”.');
    expect(screen.getByTestId('offer-decision').textContent).not.toMatch(/went through|your (earlier )?request/i);
    expect(screen.getByTestId('offer-decision-open-episode').getAttribute('href')).toBe('/episodes/ep-9');
    for (const c of choices()) expect(c.disabled).toBe(true);
    expect(screen.getByTestId('offer-decision-reason').value).toBe('The fee is too low');
    expect(onDone).not.toHaveBeenCalled();
  });

  test('checking found no episode: it says nothing was started, sends nothing, and a new explicit choice goes with the same key', async () => {
    const check = vi.fn().mockResolvedValue(readiness([]));
    const send = vi.fn().mockRejectedValueOnce(required()).mockRejectedValueOnce(network()).mockResolvedValueOnce({ data: { success: true } });
    const onDone = await open(send, check);
    await click('offer-decision-decline');
    await click('offer-decision-check');
    expect(screen.getByTestId('offer-decision-not-started').textContent).toContain('This event has no episode yet: nothing was started.');
    expect(send).toHaveBeenCalledTimes(2);
    expect(onDone).not.toHaveBeenCalled();
    for (const c of choices()) expect(c.disabled).toBe(false);
    expect(screen.getByTestId('offer-decision-reason').value).toBe('The fee is too low');
    await click('offer-decision-decline');
    expect(send).toHaveBeenCalledTimes(3);
    expect(keyOf(send, 3)).toBe(keyOf(send, 2));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ res: { data: { success: true } } }));
  });

  test('the check itself failing says so, keeps everything, and can be asked again', async () => {
    const check = vi.fn().mockRejectedValueOnce(network()).mockResolvedValueOnce(readiness([]));
    const send = vi.fn().mockRejectedValueOnce(required()).mockRejectedValueOnce(network());
    await open(send, check);
    await click('offer-decision-decline');
    await click('offer-decision-check');
    expect(screen.getByTestId('offer-decision-failed').textContent).toContain('The episode status could not be checked either.');
    expect(screen.getByTestId('offer-decision-reason').value).toBe('The fee is too low');
    await click('offer-decision-check');
    expect(check).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('offer-decision-not-started')).toBeTruthy();
    expect(send).toHaveBeenCalledTimes(2);
  });

  test('a failure that did get an answer (a 500) is not uncertain: no status check is offered', async () => {
    const check = vi.fn();
    const send = vi.fn().mockRejectedValueOnce(required()).mockRejectedValueOnce(Object.assign(new Error('500'), { response: { status: 500, data: { error: 'boom' } } }));
    await open(send, check);
    await click('offer-decision-decline');
    expect(screen.getByTestId('offer-decision-failed').textContent).toContain('Choose again to try once more, or close this.');
    expect(screen.queryByTestId('offer-decision-check')).toBeNull();
  });

  test('with no way to check (a caller that gave none), a network failure offers no check', async () => {
    const send = vi.fn().mockRejectedValueOnce(required()).mockRejectedValueOnce(network());
    await open(send);
    await click('offer-decision-decline');
    expect(screen.getByTestId('offer-decision-failed')).toBeTruthy();
    expect(screen.queryByTestId('offer-decision-check')).toBeNull();
  });
});
