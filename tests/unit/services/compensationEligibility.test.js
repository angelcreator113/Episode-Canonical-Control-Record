/**
 * Compensation eligibility, the pure parts (A2; Evoni's rulings of
 * 2026-11-13 and 14): the decision from an event's links
 * (services/startOfferDecision decideCompensation), the refusal it becomes,
 * and how Episode Money shows a line that is not owed
 * (services/episodeMoneyLines). The database behaviour is in
 * tests/integration/compensationEligibility.integration.test.js.
 */
const {
  decideCompensation, OfferResolutionError, isOfferResolutionError,
  ACCEPTED_STATUSES, CLOSED_STATUSES, COMPLETION_ELIGIBLE_STATUSES, COMPENSATION_REASONS,
} = require('../../../src/services/startOfferDecision');
const { buildMoneyLines, COMPENSATION_CATEGORIES } = require('../../../src/services/episodeMoneyLines');

const E = 'event-1';
const offer = (id, status, eventId = E) => ({ id, name: `Offer ${id}`, status, event_id: eventId, payment_amount: 900 });
const decide = (ownerId, offers) => decideCompensation({ eventId: E, ownerId, offers });

describe('decideCompensation', () => {
  it('no offer linked at all: owed, as before', () => {
    expect(decide(null, [])).toMatchObject({ linked: false, owed: true, unresolved: false, reason: 'no_linked_offer', owner: null, offers: [] });
  });

  it('the owner is the offer the event names, when it points back; accepted and alone, it is owed', () => {
    for (const status of ACCEPTED_STATUSES) {
      expect(decide('a', [offer('a', status)])).toMatchObject({ linked: true, owed: true, unresolved: false, reason: 'owner_accepted', owner: { id: 'a', status } });
    }
  });

  it('a closed offer beside an accepted owner creates no obligation and no doubt', () => {
    for (const closed of CLOSED_STATUSES) {
      expect(decide('a', [offer('a', 'booked'), offer('b', closed)])).toMatchObject({ owed: true, reason: 'owner_accepted' });
    }
  });

  it('an owner that is open or closed, alone: not owed', () => {
    for (const status of ['offered', 'considering', 'negotiating', 'held']) {
      expect(decide('a', [offer('a', status)])).toMatchObject({ owed: false, unresolved: false, reason: 'owner_not_accepted' });
    }
    for (const status of CLOSED_STATUSES) {
      expect(decide('a', [offer('a', status)])).toMatchObject({ owed: false, unresolved: false, reason: 'owner_closed' });
    }
  });

  it('another live offer beside the owner is never resolved by guessing', () => {
    const cases = [
      [offer('a', 'booked'), offer('b', 'offered')],
      [offer('a', 'booked'), offer('b', 'active')],
      [offer('a', 'declined'), offer('b', 'booked')],
      [offer('a', 'offered'), offer('b', 'negotiating')],
      [offer('a', 'cancelled'), offer('b', 'held')],
    ];
    for (const offers of cases) {
      expect(decide('a', offers)).toMatchObject({ owed: null, unresolved: true, reason: 'multiple_live_offers', owner: { id: 'a' } });
    }
  });

  it('an event that names no owner does not get one from an offer that points at it', () => {
    for (const status of ['booked', 'offered', 'declined']) {
      expect(decide(null, [offer('b', status)])).toMatchObject({ linked: true, owed: null, unresolved: true, reason: 'no_owner', owner: null });
    }
  });

  it('the owner named is gone, or points at another event or at none: unresolved', () => {
    expect(decide('a', [])).toMatchObject({ linked: true, unresolved: true, reason: 'owner_missing' });
    expect(decide('a', [offer('b', 'booked')])).toMatchObject({ unresolved: true, reason: 'owner_missing' });
    expect(decide('a', [offer('a', 'booked', 'another-event')])).toMatchObject({ unresolved: true, reason: 'owner_link_conflict', owner: null });
    expect(decide('a', [offer('a', 'booked', null)])).toMatchObject({ unresolved: true, reason: 'owner_link_conflict' });
  });

  it('names offers by id, name and status only: never their terms', () => {
    const d = decide('a', [offer('a', 'booked'), offer('b', 'offered')]);
    expect(d.offers).toEqual([{ id: 'a', name: 'Offer a', status: 'booked' }, { id: 'b', name: 'Offer b', status: 'offered' }]);
    expect(JSON.stringify(d)).not.toMatch(/900|payment/);
  });

  it('every reason it gives is one of the named ones', () => {
    const all = [decide(null, []), decide('a', [offer('a', 'booked')]), decide('a', [offer('a', 'offered')]), decide('a', [offer('a', 'declined')]),
      decide(null, [offer('b', 'booked')]), decide('a', []), decide('a', [offer('a', 'booked', 'x')]), decide('a', [offer('a', 'booked'), offer('b', 'booked')])];
    expect(new Set(all.map((d) => d.reason))).toEqual(new Set(Object.values(COMPENSATION_REASONS)));
  });

  it('accepted is the canonical list; the statuses Complete moves on are the accepted ones not yet completed', () => {
    expect(ACCEPTED_STATUSES).toEqual(['booked', 'preparing', 'active', 'completed', 'paid']);
    expect(COMPLETION_ELIGIBLE_STATUSES).toEqual(['booked', 'preparing', 'active']);
    expect(COMPLETION_ELIGIBLE_STATUSES.every((s) => ACCEPTED_STATUSES.includes(s))).toBe(true);
  });
});

describe('OfferResolutionError', () => {
  it('is a 409 that says what to do and names the offers without their terms', () => {
    const err = new OfferResolutionError(decide('a', [offer('a', 'declined'), offer('b', 'booked')]), 'Velour Night');
    expect(isOfferResolutionError(err)).toBe(true);
    expect(isOfferResolutionError(new Error('x'))).toBe(false);
    expect(err).toMatchObject({ status: 409, code: 'OFFER_RESOLUTION_REQUIRED' });
    expect(err.message).toContain('Nothing was booked for "Velour Night"');
    expect(err.message).toContain('"Offer a" (declined)');
    expect(err.toJSON()).toEqual({
      success: false, code: 'OFFER_RESOLUTION_REQUIRED', error: err.message, reason: 'multiple_live_offers',
      owner: { id: 'a', name: 'Offer a', status: 'declined' },
      offers: [{ id: 'a', name: 'Offer a', status: 'declined' }, { id: 'b', name: 'Offer b', status: 'booked' }],
    });
  });
});

describe('Episode Money: a compensation line that is not owed', () => {
  const income = (category, extra = {}) => ({ key: `${category}|x`, kind: 'income', category, label: category, amount: 400, conditional: false, covered: false, source: { type: 'event', id: 'x' }, ...extra });
  const cost = { key: 'event_cost|c', kind: 'expense', category: 'event_cost', label: 'Car', amount: 80, conditional: false, covered: false, source: { type: 'event_cost', id: 'c' } };
  const notOwed = { linked: true, owed: false, reason: 'owner_closed' };
  const state = (built, category) => built.lines.find((l) => l.category === category);

  it('owed, or no offer linked: planned as before', () => {
    for (const compensation of [null, { linked: false, owed: true }, { linked: true, owed: true, reason: 'owner_accepted' }]) {
      const built = buildMoneyLines({ plan: [income('appearance_fee'), cost], compensation });
      expect(state(built, 'appearance_fee').state).toBe('planned');
      expect(built.projection.planned_net).toBe(320);
    }
  });

  it('not owed: every compensation category reads not owed and none is counted; her cost is', () => {
    const plan = [...COMPENSATION_CATEGORIES.filter((c) => c !== 'deal_bonus').map((c) => income(c)), cost];
    const built = buildMoneyLines({ plan, compensation: notOwed });
    for (const c of COMPENSATION_CATEGORIES.filter((x) => x !== 'deal_bonus')) {
      expect(state(built, c)).toMatchObject({ state: 'not_owed', not_owed_reason: 'owner_closed', amount: 400 });
    }
    expect(state(built, 'event_cost').state).toBe('planned');
    expect(built.projection.planned_net).toBe(-80);
    expect(built.projection.pending_net).toBe(0);
    expect(built.projection.open_count).toBe(1);
  });

  it('unresolved reads not owed too: nothing is promised while it cannot be said', () => {
    const built = buildMoneyLines({ plan: [income('appearance_fee')], compensation: { linked: true, owed: false, unresolved: true, reason: 'no_owner' } });
    expect(state(built, 'appearance_fee')).toMatchObject({ state: 'not_owed', not_owed_reason: 'no_owner' });
  });

  it('a bonus tier is not dangled when it is not owed', () => {
    const bonus = income('deal_bonus', { key: 'deal_bonus|x|slay', conditional: true, tier: 'slay' });
    expect(buildMoneyLines({ plan: [bonus], compensation: notOwed }).projection.conditional).toEqual([]);
    expect(buildMoneyLines({ plan: [bonus], compensation: null }).projection.conditional).toEqual([{ tier: 'slay', amount: 400, label: 'deal_bonus' }]);
  });

  it('a posted row is posted, whatever the answer is now', () => {
    const rows = [{ id: 'r1', category: 'appearance_fee', source_id: 'x', amount: 400, signed: 400 }];
    const built = buildMoneyLines({ plan: [income('appearance_fee')], rows, compensation: notOwed });
    expect(state(built, 'appearance_fee').state).toBe('posted');
  });

  it('once its moment has passed with nothing booked, it is not owed even if the offer is accepted later', () => {
    const accepted = { linked: true, owed: true, reason: 'owner_accepted' };
    const completed = buildMoneyLines({ plan: [income('appearance_fee')], completed: true, compensation: accepted });
    expect(state(completed, 'appearance_fee')).toMatchObject({ state: 'not_owed', not_owed_reason: null });
    const approved = buildMoneyLines({ plan: [income('content_fee', { deliverable_status: 'approved' })], compensation: accepted });
    expect(state(approved, 'content_fee').state).toBe('not_owed');
    // A deliverable not yet approved is still to come.
    const submitted = buildMoneyLines({ plan: [income('content_fee', { deliverable_status: 'submitted' })], compensation: accepted });
    expect(state(submitted, 'content_fee').state).toBe('pending');
  });
});
