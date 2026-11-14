/**
 * services/startOfferDecision and services/opportunityStatusFlow, the pure
 * parts: which offers are open, the legal path to each decision's status,
 * and the refusals. The DB-backed behaviour is in
 * tests/integration/startEpisodeOfferDecision.integration.test.js.
 */

const { statusPath, STATUS_FLOW } = require('../../../src/services/opportunityStatusFlow');
const {
  isOpenOffer, assertOfferDecision, offerDecisionBody, OFFER_DECISIONS, OFFER_DECISION_CODES, REASON_REQUIRED_DECISIONS,
} = require('../../../src/services/startOfferDecision');
const audit = require('../../../src/services/opportunityTransitionAudit');

// An admin's decision about the offer below, with a reason (A1, 2026-11-13).
const admin = (over = {}) => ({ actor: { id: 'admin-1', isAdmin: true }, reason: 'Recorded', opportunityIds: ['opp-1'], ...over });

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
  it('an open offer and no decision, asked by an admin: 409 OFFER_DECISION_REQUIRED with the offer summary', () => {
    let err;
    try { assertOfferDecision([offer('offered')], undefined, admin()); } catch (e) { err = e; }
    expect(err).toMatchObject({ status: 409, code: 'OFFER_DECISION_REQUIRED' });
    // The admin's answer, as it has always been, with can_decide.
    expect(offerDecisionBody(err)).toEqual({
      success: false,
      code: 'OFFER_DECISION_REQUIRED',
      error: err.message,
      decisions: OFFER_DECISIONS,
      can_decide: true,
      opportunity: { id: 'opp-1', name: 'Spring Capsule', status: 'offered', brand: 'Maison', payment_amount: 1200, payment_type: 'flat_fee' },
      opportunities: [{ id: 'opp-1', name: 'Spring Capsule', status: 'offered', brand: 'Maison', payment_amount: 1200, payment_type: 'flat_fee' }],
    });
  });

  // Security review of 2026-11-13: the deal's terms never go to someone who cannot decide.
  it('asked by anyone else: only which offer waits (id, name, status); no payment, payment type or brand', () => {
    for (const by of [undefined, {}, { actor: null }, { actor: { id: 'u-1', isAdmin: false } }, { actor: { id: 'u-1', isAdmin: 'yes' } }]) {
      let err;
      try { assertOfferDecision([offer('offered')], undefined, by); } catch (e) { err = e; }
      const body = offerDecisionBody(err);
      expect(body).toEqual({
        success: false,
        code: 'OFFER_DECISION_REQUIRED',
        error: err.message,
        decisions: OFFER_DECISIONS,
        can_decide: false,
        opportunity: { id: 'opp-1', name: 'Spring Capsule', status: 'offered' },
        opportunities: [{ id: 'opp-1', name: 'Spring Capsule', status: 'offered' }],
      });
      expect(JSON.stringify(body)).not.toMatch(/1200|payment|flat_fee|Maison/);
    }
  });

  it('a decision refused because the person is not an admin carries no terms either', () => {
    for (const d of OFFER_DECISIONS) {
      let err;
      try { assertOfferDecision([offer('offered')], d, { actor: { id: 'u-1', isAdmin: false }, reason: 'x', opportunityIds: ['opp-1'] }); } catch (e) { err = e; }
      const body = offerDecisionBody(err);
      expect(body.code).toBe('OFFER_DECISION_FORBIDDEN');
      expect(body.opportunities).toEqual([{ id: 'opp-1', name: 'Spring Capsule', status: 'offered' }]);
      expect(JSON.stringify(body)).not.toMatch(/1200|payment|flat_fee|Maison/);
    }
  });

  it('every refusal an admin can get still carries the full summary', () => {
    const full = { id: 'opp-1', name: 'Spring Capsule', status: 'offered', brand: 'Maison', payment_amount: 1200, payment_type: 'flat_fee' };
    const cases = [
      ['decline', admin({ reason: '' })],              // reason required
      ['accept', admin({ opportunityIds: ['other'] })], // stale
      ['book_it', admin()],                              // unknown decision
    ];
    for (const [d, by] of cases) {
      let err;
      try { assertOfferDecision([offer('offered')], d, by); } catch (e) { err = e; }
      expect(offerDecisionBody(err).opportunity).toEqual(full);
    }
    let illegal;
    try { assertOfferDecision([offer('held')], 'accept', admin()); } catch (e) { illegal = e; }
    expect(offerDecisionBody(illegal).opportunity).toEqual({ ...full, status: 'held' });
  });
  it('every decision is legal from offered; none is chosen for the caller', () => {
    for (const d of OFFER_DECISIONS) expect(() => assertOfferDecision([offer('offered')], d, admin())).not.toThrow();
  });
  it('an unknown decision is a 400', () => {
    expect(() => assertOfferDecision([offer('offered')], 'book', admin())).toThrow(expect.objectContaining({ status: 400, code: 'OFFER_DECISION_INVALID' }));
  });
  it('held: only proceed_unaccepted is legal', () => {
    for (const d of ['accept', 'negotiate', 'decline']) {
      expect(() => assertOfferDecision([offer('held')], d, admin())).toThrow(expect.objectContaining({ status: 409, code: 'OFFER_DECISION_ILLEGAL' }));
    }
    expect(() => assertOfferDecision([offer('held')], 'proceed_unaccepted', admin())).not.toThrow();
  });
});

describe('assertOfferDecision: who, why and which offers (A1, 2026-11-13)', () => {
  it('a decision is an admin\'s: no actor, or one who is not an admin, is a 403', () => {
    for (const by of [undefined, {}, admin({ actor: null }), admin({ actor: { id: 'u-1', isAdmin: false } })]) {
      for (const d of OFFER_DECISIONS) {
        expect(() => assertOfferDecision([offer('offered')], d, by)).toThrow(expect.objectContaining({ status: 403, code: 'OFFER_DECISION_FORBIDDEN' }));
      }
    }
  });
  it('no decision is still the question, whoever asks; it says whether they can answer it', () => {
    const asked = (by) => { try { assertOfferDecision([offer('offered')], undefined, by); } catch (e) { return e; } return null; };
    const anyone = asked({});
    expect(anyone).toMatchObject({ status: 409, code: 'OFFER_DECISION_REQUIRED' });
    expect(offerDecisionBody(anyone).can_decide).toBe(false);
    expect(anyone.message).toMatch(/An admin decides/);
    expect(anyone.message).not.toMatch(/Choose whether/);
    expect(offerDecisionBody(asked({ actor: { id: 'u-1', isAdmin: false } })).can_decide).toBe(false);
    const adminAsked = asked(admin());
    expect(adminAsked).toMatchObject({ status: 409, code: 'OFFER_DECISION_REQUIRED' });
    expect(offerDecisionBody(adminAsked).can_decide).toBe(true);
    expect(adminAsked.message).toMatch(/Choose whether to accept it, negotiate, decline it, or start the episode without accepting it/);
    // A refused decision says the same.
    let refused;
    try { assertOfferDecision([offer('offered')], 'accept', {}); } catch (e) { refused = e; }
    expect(offerDecisionBody(refused)).toMatchObject({ code: 'OFFER_DECISION_FORBIDDEN', can_decide: false });
  });
  it('the offers named must be exactly the open ones, in any order', () => {
    const two = [offer('offered'), { ...offer('considering'), id: 'opp-2' }];
    for (const ids of [undefined, null, [], ['opp-1'], ['opp-1', 'opp-3'], ['opp-1', 'opp-2', 'opp-3'], 'opp-1']) {
      expect(() => assertOfferDecision(two, 'accept', admin({ opportunityIds: ids }))).toThrow(expect.objectContaining({ status: 409, code: 'OFFER_DECISION_STALE' }));
    }
    expect(() => assertOfferDecision(two, 'accept', admin({ opportunityIds: ['opp-2', 'opp-1'] }))).not.toThrow();
  });
  it('decline and proceed_unaccepted need a reason; accept and negotiate do not', () => {
    expect(REASON_REQUIRED_DECISIONS).toEqual(['decline', 'proceed_unaccepted']);
    for (const d of REASON_REQUIRED_DECISIONS) {
      for (const reason of [undefined, null, '', '   ']) {
        expect(() => assertOfferDecision([offer('offered')], d, admin({ reason }))).toThrow(expect.objectContaining({ status: 400, code: 'OFFER_REASON_REQUIRED' }));
      }
    }
    for (const d of ['accept', 'negotiate']) expect(() => assertOfferDecision([offer('offered')], d, admin({ reason: undefined }))).not.toThrow();
  });
  it('a reason that is not text, or is too long, is a 400 for any decision', () => {
    for (const reason of [42, { a: 1 }, 'x'.repeat(audit.REASON_MAX + 1)]) {
      expect(() => assertOfferDecision([offer('offered')], 'accept', admin({ reason }))).toThrow(expect.objectContaining({ status: 400, code: 'OFFER_REASON_REQUIRED' }));
    }
  });
  it('the routes answer every refusal with the offer body', () => {
    expect(OFFER_DECISION_CODES).toEqual(expect.arrayContaining(['OFFER_DECISION_FORBIDDEN', 'OFFER_DECISION_STALE', 'OFFER_REASON_REQUIRED']));
  });
});

describe('opportunityTransitionAudit (pure parts)', () => {
  it('readReason: trimmed text, null when none, an error when not text or too long', () => {
    expect(audit.readReason(undefined)).toEqual({ reason: null });
    expect(audit.readReason('  why  ')).toEqual({ reason: 'why' });
    expect(audit.readReason('   ')).toEqual({ reason: null });
    expect(audit.readReason(7).error).toBeTruthy();
    expect(audit.readReason('x'.repeat(audit.REASON_MAX)).reason).toHaveLength(audit.REASON_MAX);
    expect(audit.readReason('x'.repeat(audit.REASON_MAX + 1)).error).toBeTruthy();
  });
  it('historyFields: who by id only, why, and the route', () => {
    expect(audit.historyFields({ actor: { id: 7, email: 'a@b.c', name: 'A' }, reason: 'why', route: 'advance' }))
      .toEqual({ by: { id: '7' }, reason: 'why', route: 'advance' });
    expect(audit.historyFields({ actor: null, reason: '', route: 'undo' })).toEqual({ by: { id: null }, reason: null, route: 'undo' });
  });
  it('historyWithoutReasons drops who and why and keeps every other key, old entries included', () => {
    const history = [
      { status: 'offered', date: 'd1' },
      { status: 'considering', date: 'd2', note: null, from: 'offered', by: { id: '7' }, reason: 'why', route: 'advance' },
      { status: 'offered', date: 'd3', note: 'Undone', undone_from: 'considering', by: { id: '7' }, reason: 'slip', route: 'undo' },
      null,
    ];
    expect(audit.historyWithoutReasons(history)).toEqual([
      { status: 'offered', date: 'd1' },
      { status: 'considering', date: 'd2', note: null, from: 'offered', route: 'advance' },
      { status: 'offered', date: 'd3', note: 'Undone', undone_from: 'considering', route: 'undo' },
      null,
    ]);
    expect(audit.historyWithoutReasons(null)).toBeNull();
    expect(history[1].reason).toBe('why');
  });
});
