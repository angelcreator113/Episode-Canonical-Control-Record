/**
 * services/startOfferDecision and services/opportunityStatusFlow, the pure
 * parts: which offers are open, the legal path to each decision's status,
 * and the refusals. The DB-backed behaviour is in
 * tests/integration/startEpisodeOfferDecision.integration.test.js.
 */

const { statusPath, STATUS_FLOW } = require('../../../src/services/opportunityStatusFlow');
const {
  isOpenOffer, assertOfferDecision, offerDecisionBody, OFFER_DECISIONS,
} = require('../../../src/services/startOfferDecision');

const offer = (status) => ({ id: 'opp-1', name: 'Spring Capsule', status, payment_amount: '1200.00', payment_type: 'flat_fee', brand_or_company: 'Maison' });

describe('statusPath (STATUS_FLOW, unchanged)', () => {
  it('accepting from offered goes through considering and negotiating', () => {
    expect(statusPath('offered', 'booked')).toEqual(['considering', 'negotiating', 'booked']);
    expect(statusPath('considering', 'booked')).toEqual(['negotiating', 'booked']);
    expect(statusPath('negotiating', 'booked')).toEqual(['booked']);
  });
  it('declining is one step from any open status', () => {
    for (const s of ['offered', 'considering', 'negotiating']) expect(statusPath(s, 'declined')).toEqual(['declined']);
  });
  it('already there is no step; held has no way anywhere', () => {
    expect(statusPath('negotiating', 'negotiating')).toEqual([]);
    expect(statusPath('held', 'booked')).toBeNull();
    expect(statusPath('held', 'declined')).toBeNull();
  });
  it('the flow is the one Advance uses', () => {
    expect(require('../../../src/services/opportunityStatusFlow').STATUS_FLOW).toBe(STATUS_FLOW);
    expect(STATUS_FLOW.offered).toEqual(['considering', 'declined']);
  });
});

describe('isOpenOffer', () => {
  it('open: not accepted and not closed', () => {
    expect(['offered', 'considering', 'negotiating', 'held'].every(isOpenOffer)).toBe(true);
    expect(['booked', 'preparing', 'active', 'completed', 'paid', 'declined', 'expired', 'cancelled', 'archived'].some(isOpenOffer)).toBe(false);
  });
});

describe('assertOfferDecision', () => {
  it('no open offer: anything goes, nothing asked', () => {
    expect(() => assertOfferDecision([], undefined)).not.toThrow();
  });
  it('an open offer and no decision: 409 OFFER_DECISION_REQUIRED with the offer summary', () => {
    let err;
    try { assertOfferDecision([offer('offered')], undefined); } catch (e) { err = e; }
    expect(err).toMatchObject({ status: 409, code: 'OFFER_DECISION_REQUIRED' });
    expect(offerDecisionBody(err)).toEqual({
      success: false,
      code: 'OFFER_DECISION_REQUIRED',
      error: err.message,
      decisions: OFFER_DECISIONS,
      opportunity: { id: 'opp-1', name: 'Spring Capsule', status: 'offered', brand: 'Maison', payment_amount: 1200, payment_type: 'flat_fee' },
      opportunities: [expect.objectContaining({ id: 'opp-1' })],
    });
  });
  it('every decision is legal from offered; none is chosen for the caller', () => {
    for (const d of OFFER_DECISIONS) expect(() => assertOfferDecision([offer('offered')], d)).not.toThrow();
  });
  it('an unknown decision is a 400', () => {
    expect(() => assertOfferDecision([offer('offered')], 'book')).toThrow(expect.objectContaining({ status: 400, code: 'OFFER_DECISION_INVALID' }));
  });
  it('held: only proceed_unaccepted is legal', () => {
    for (const d of ['accept', 'negotiate', 'decline']) {
      expect(() => assertOfferDecision([offer('held')], d)).toThrow(expect.objectContaining({ status: 409, code: 'OFFER_DECISION_ILLEGAL' }));
    }
    expect(() => assertOfferDecision([offer('held')], 'proceed_unaccepted')).not.toThrow();
  });
});
