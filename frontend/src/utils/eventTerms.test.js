import { describe, test, expect } from 'vitest';
import {
  describeRequirements, requirementsDraftFrom, buildRequirementsUpdate,
  restrictionsOf, buildRestrictionAdd, buildRestrictionRemove, restrictionLabel,
  describeCompensation, compensationDraftFrom, buildCompensationUpdate,
  buildDeliverableBody, deliverableDraftFrom,
  DELIVERABLE_STATUS_FLOW, deliverableStatusOf, nextDeliverableStatus, deliverableAdvanceLabel,
  formatFulfilmentDate, deliverableTimeline,
  DEAL_TYPES, DEAL_TYPE_LABELS, describeDealType, buildDealTypeUpdate,
  describeComponentFee, describeGiftedValue, describeDeliverableFee, premiumChoicesFrom, buildProposeBody,
  DELIVERABLE_TYPES, DELIVERABLE_TYPE_LABELS, deliverableTypeLabel, deliverablePhrase, hasRateAnchor, dealPlanFor,
  missingPriceLabels, buildComponentFeeUpdate, deliverableDraftNote,
} from './eventTerms';

describe('access requirements', () => {
  test('known keys first, zeros hidden, other keys as stored', () => {
    const ev = { requirements: { coins_min: 100, reputation_min: 0, brand_trust_min: 4, portfolio_min: 10 } };
    expect(describeRequirements(ev)).toEqual([
      { key: 'brand_trust_min', label: 'Brand trust at least', value: '4' },
      { key: 'coins_min', label: 'Coins at least', value: '100' },
      { key: 'portfolio_min', label: 'Portfolio Min', value: '10' },
    ]);
    expect(describeRequirements({})).toEqual([]);
  });

  test('update keeps unknown keys, drops emptied/zero known keys, validates', () => {
    const ev = { requirements: { reputation_min: 3, portfolio_min: 10 } };
    const draft = { ...requirementsDraftFrom(ev), reputation_min: '', coins_min: '50' };
    expect(buildRequirementsUpdate(ev, draft)).toEqual({
      body: { requirements: { portfolio_min: 10, coins_min: 50 } }, unchanged: false, errors: [],
    });
    expect(buildRequirementsUpdate(ev, requirementsDraftFrom(ev)).unchanged).toBe(true);
    expect(buildRequirementsUpdate(ev, { ...draft, coins_min: '-1' }).errors).toHaveLength(1);
    expect(buildRequirementsUpdate(ev, { ...draft, coins_min: '2.5' }).errors).toHaveLength(1);
  });

  test('the old editor\'s all-zero default counts as no requirements, unchanged when left empty', () => {
    const ev = { requirements: { reputation_min: 0, brand_trust_min: 0, coins_min: 0 } };
    expect(requirementsDraftFrom(ev)).toEqual({ reputation_min: '', brand_trust_min: '', coins_min: '' });
    expect(buildRequirementsUpdate(ev, requirementsDraftFrom(ev)).unchanged).toBe(true);
  });
});

describe('restrictions', () => {
  test('stored array normalised; strings accepted; junk dropped', () => {
    expect(restrictionsOf({ restrictions: [{ type: 'exclusivity', description: 'No rivals' }, 'No leaks', { description: '' }, 7] }))
      .toEqual([{ type: 'exclusivity', description: 'No rivals' }, { type: 'other', description: 'No leaks' }]);
    expect(restrictionsOf({ restrictions: null })).toEqual([]);
    expect(restrictionsOf({ restrictions: '[{"type":"other","description":"x"}]' })).toEqual([{ type: 'other', description: 'x' }]);
  });

  test('add appends; remove drops by index; empty text is an error', () => {
    const ev = { restrictions: [{ type: 'exclusivity', description: 'No rivals' }] };
    expect(buildRestrictionAdd(ev, '  No leaks ').body).toEqual({
      restrictions: [{ type: 'exclusivity', description: 'No rivals' }, { type: 'other', description: 'No leaks' }],
    });
    expect(buildRestrictionAdd(ev, ' ').error).toBeTruthy();
    expect(buildRestrictionRemove(ev, 0).body).toEqual({ restrictions: [] });
    expect(restrictionLabel('exclusivity')).toBe('Exclusivity');
    expect(restrictionLabel('other')).toBe('Restriction');
  });
});

describe('compensation', () => {
  test('summary', () => {
    expect(describeCompensation({ is_paid: true, payment_amount: 1500 }).summary).toBe('Paid: 1500 coins');
    expect(describeCompensation({ is_paid: false, payment_amount: 0 }).summary).toBe('Unpaid');
    // Carried from an opportunity with is_paid off (Evoni, 2026-09-24).
    expect(describeCompensation({ is_paid: false, payment_amount: 1500 }).summary).toBe('Agreed: 1500 coins (not paid out)');
  });

  test('paid needs a whole amount above 0; unpaid keeps the stored amount', () => {
    const ev = { is_paid: false, payment_amount: 0 };
    expect(buildCompensationUpdate(ev, { is_paid: true, payment_amount: '1500' }))
      .toEqual({ body: { is_paid: true, payment_amount: 1500 }, unchanged: false, errors: [] });
    expect(buildCompensationUpdate(ev, { is_paid: true, payment_amount: '' }).errors).toHaveLength(1);
    expect(buildCompensationUpdate(ev, { is_paid: true, payment_amount: '12.5' }).errors).toHaveLength(1);
    expect(buildCompensationUpdate(ev, compensationDraftFrom(ev)).unchanged).toBe(true);
    const paid = { is_paid: true, payment_amount: 1500 };
    expect(buildCompensationUpdate(paid, { is_paid: false, payment_amount: '1500' }).body).toEqual({ is_paid: false, payment_amount: 1500 });
    const agreed = { is_paid: false, payment_amount: 1500 };
    expect(buildCompensationUpdate(agreed, compensationDraftFrom(agreed)).unchanged).toBe(true);
  });
});

describe('deliverable form', () => {
  test('body trims and nulls empties; description required', () => {
    expect(buildDeliverableBody({ description: ' Tagged post ', deliverable_type: ' ', due_date: '2026-11-07', required: false }))
      .toEqual({ body: { description: 'Tagged post', deliverable_type: null, due_date: '2026-11-07', required: false, owed_to: 'host' } });
    expect(buildDeliverableBody({ description: '' }).error).toBeTruthy();
    // The form carries a fee (Task #2341): empty in the draft, null in the body.
    expect(deliverableDraftFrom(null)).toEqual({ description: '', deliverable_type: '', legacy_type: null, platform: '', quantity: '', due_date: '', required: true, owed_to: 'host', fee: '' });
    expect(buildDeliverableBody(deliverableDraftFrom(null)).error).toBeTruthy();
    expect(buildDeliverableBody({ description: 'Reel', fee: '' }).body.fee).toBeNull();
    expect(buildDeliverableBody({ description: 'Reel', fee: '125' }).body.fee).toBe(125);
    expect(buildDeliverableBody({ description: 'Reel', fee: '12.5' }).error).toBeTruthy();
    expect(buildDeliverableBody({ description: 'Reel', fee: '-1' }).error).toBeTruthy();
    expect(deliverableDraftFrom({ description: 'Reel', fee: 125 }).fee).toBe('125');
    // T2 (Task #2294): owed_to is host or brand; anything else reads as host.
    expect(buildDeliverableBody({ description: 'Reel', owed_to: 'brand' }).body.owed_to).toBe('brand');
    expect(buildDeliverableBody({ description: 'Reel', owed_to: 'sponsor' }).body.owed_to).toBe('host');
    expect(deliverableDraftFrom({ description: 'Reel', owed_to: 'brand' }).owed_to).toBe('brand');
  });
});

describe('fulfilment (Task #1815)', () => {
  test('one step forward at a time, nothing after approved', () => {
    expect(DELIVERABLE_STATUS_FLOW).toEqual(['pending', 'completed', 'submitted', 'approved']);
    expect(nextDeliverableStatus('pending')).toBe('completed');
    expect(nextDeliverableStatus('completed')).toBe('submitted');
    expect(nextDeliverableStatus('submitted')).toBe('approved');
    expect(nextDeliverableStatus('approved')).toBeNull();
    expect(nextDeliverableStatus('bogus')).toBeNull();
  });

  test('an unknown or missing status reads as pending', () => {
    expect(deliverableStatusOf({ status: 'submitted' })).toBe('submitted');
    expect(deliverableStatusOf({ status: 'done' })).toBe('pending');
    expect(deliverableStatusOf(null)).toBe('pending');
  });

  test('advance labels', () => {
    expect(deliverableAdvanceLabel('completed')).toBe('Mark completed');
    expect(deliverableAdvanceLabel('submitted')).toBe('Mark submitted');
    expect(deliverableAdvanceLabel('approved')).toBe('Mark approved');
    expect(deliverableAdvanceLabel(null)).toBeNull();
  });

  test('dates: absent or unreadable is null', () => {
    expect(formatFulfilmentDate(null)).toBeNull();
    expect(formatFulfilmentDate('not a date')).toBeNull();
    expect(formatFulfilmentDate('2026-09-24T12:00:00Z')).toMatch(/2026/);
  });

  test('timeline lists the reached steps in order, each with its own timestamp', () => {
    const t = deliverableTimeline({
      status: 'submitted',
      completed_at: '2026-09-20T12:00:00Z',
      submitted_at: '2026-09-22T12:00:00Z',
      approved_at: null,
    });
    expect(t.map((s) => [s.status, s.label, s.at])).toEqual([
      ['completed', 'Completed', '2026-09-20T12:00:00.000Z'],
      ['submitted', 'Submitted', '2026-09-22T12:00:00.000Z'],
    ]);
    expect(deliverableTimeline({ status: 'pending' })).toEqual([]);
  });
});

describe('deal type (Task #2330)', () => {
  const withDraft = (value, drafted, source = 'rule') => ({
    deal_type: value,
    canon_consequences: { automation: { auto_drafted: { deal_type: source }, drafted_values: { deal_type: drafted } } },
  });

  test('eight types, each with a label', () => {
    expect(DEAL_TYPES).toHaveLength(8);
    for (const t of DEAL_TYPES) expect(DEAL_TYPE_LABELS[t]).toBeTruthy();
  });

  test('state: Auto-drafted while equal to the draft, Edited once it differs, set with no draft, missing when empty', () => {
    expect(describeDealType(withDraft('self_funded', 'self_funded'))).toEqual({ value: 'self_funded', label: 'Self-funded', state: 'auto_drafted', note: 'Auto-drafted · rule' });
    expect(describeDealType(withDraft('gifted', 'self_funded'))).toMatchObject({ state: 'edited', note: 'Edited' });
    expect(describeDealType({ deal_type: 'gifted' })).toMatchObject({ state: 'set', note: null });
    expect(describeDealType({})).toEqual({ value: null, label: 'Not set', state: 'missing', note: null });
  });

  test('update body: only deal_type; unchanged and unknown values are caught', () => {
    expect(buildDealTypeUpdate({ deal_type: 'gifted' }, 'paid_appearance')).toEqual({ body: { deal_type: 'paid_appearance' }, unchanged: false, error: null });
    expect(buildDealTypeUpdate({ deal_type: 'gifted' }, 'gifted').unchanged).toBe(true);
    expect(buildDealTypeUpdate({ deal_type: 'gifted' }, '')).toEqual({ body: { deal_type: null }, unchanged: false, error: null });
    expect(buildDealTypeUpdate({}, 'sponsorship').error).toBeTruthy();
  });
});

describe('deliverable formats (ruling D15, 2026-09-30; replacing the Deal PR 3 list)', () => {
  test('the formats, with their labels; "Story Set (3)" is "Instagram Stories (×3)"', () => {
    expect(DELIVERABLE_TYPES).toEqual(['instagram_reel', 'instagram_post', 'tiktok_video', 'grwm_video', 'instagram_stories',
      'carousel_post', 'go_live', 'link_in_bio', 'try_on_haul', 'ugc', 'other']);
    expect(DELIVERABLE_TYPE_LABELS.instagram_stories).toBe('Instagram Stories');
    expect(deliverableTypeLabel({ deliverable_type: 'instagram_stories', quantity: 3 })).toBe('Instagram Stories (×3)');
    expect(deliverableTypeLabel({ deliverable_type: 'link_in_bio', quantity: 7 })).toBe('Link in bio (7 days)');
    expect(deliverableTypeLabel('instagram_reel')).toBe('Instagram Reel');
    expect(deliverableTypeLabel('reel')).toBe('reel (no type chosen)');
    expect(deliverableTypeLabel(null)).toBeNull();
  });

  test('labels read naturally, as the server writes them ("1 TikTok GRWM, 3 Instagram Stories")', () => {
    expect(deliverablePhrase({ deliverable_type: 'grwm_video', platform: 'tiktok', quantity: 1 })).toBe('1 TikTok GRWM');
    expect(deliverablePhrase({ deliverable_type: 'instagram_stories', quantity: 3 })).toBe('3 Instagram Stories');
    expect(deliverablePhrase({ deliverable_type: 'link_in_bio', platform: 'tiktok', quantity: 10 })).toBe('Link in bio on TikTok (10 days)');
    expect(deliverablePhrase({ deliverable_type: 'Sponsored post' })).toBeNull();
  });

  test('every format but Other takes an automatic anchor', () => {
    expect(DELIVERABLE_TYPES.filter((t) => !hasRateAnchor(t))).toEqual(['other']);
    expect(hasRateAnchor('reel')).toBe(false);
    expect(hasRateAnchor('')).toBe(false);
  });

  test('a type off the list is refused; an untyped legacy row keeps its text until a type is chosen', () => {
    expect(buildDeliverableBody({ description: 'Reel', deliverable_type: 'appearance' }).error).toBe('Type: choose one of the listed types');
    expect(buildDeliverableBody({ description: 'Reel', deliverable_type: 'instagram_reel' }).body)
      .toMatchObject({ deliverable_type: 'instagram_reel', platform: 'instagram', quantity: 1 });
    const legacy = deliverableDraftFrom({ description: 'Old reel', deliverable_type: 'IG reel' });
    expect(legacy).toMatchObject({ deliverable_type: '', legacy_type: 'IG reel', platform: '', quantity: '' });
    expect(buildDeliverableBody(legacy).body).not.toHaveProperty('deliverable_type');
    expect(buildDeliverableBody({ ...legacy, deliverable_type: 'instagram_reel' }).body.deliverable_type).toBe('instagram_reel');
    expect(deliverableDraftFrom({ description: 'Q&A', deliverable_type: 'other' })).toMatchObject({ deliverable_type: 'other', legacy_type: null });
  });

  test('platform and quantity: defaults, a platform the format is not on, and the quantity range', () => {
    expect(deliverableDraftFrom({ description: 'Stories', deliverable_type: 'instagram_stories', quantity: 5 }))
      .toMatchObject({ platform: 'instagram', quantity: '5' });
    expect(buildDeliverableBody({ description: 'Stories', deliverable_type: 'instagram_stories', quantity: '' }).body.quantity).toBe(3);
    expect(buildDeliverableBody({ description: 'GRWM', deliverable_type: 'grwm_video', platform: '' }).error).toBe('Platform: choose TikTok, Instagram, YouTube');
    expect(buildDeliverableBody({ description: 'GRWM', deliverable_type: 'instagram_reel', platform: 'tiktok' }).error).toBe('Platform: Instagram Reel is on Instagram');
    expect(buildDeliverableBody({ description: 'Bio', deliverable_type: 'link_in_bio', quantity: '0' }).error).toBe('Days: a whole number from 1 to 365');
    expect(buildDeliverableBody({ description: 'Bio', deliverable_type: 'link_in_bio', platform: '', quantity: '14' }).body)
      .toMatchObject({ platform: null, quantity: 14 });
    expect(buildDeliverableBody({ description: 'UGC', deliverable_type: 'ugc', quantity: '2' }).body).toMatchObject({ platform: null, quantity: 2 });
  });
});

describe('deal plans (Task #2341; Deal PR 3 ruling, points 1 and 4)', () => {
  const keys = (event) => dealPlanFor(event).components.map((c) => c.field);
  test('each deal type\'s components', () => {
    expect(keys({ deal_type: 'paid_appearance' })).toEqual(['appearance_fee']);
    expect(keys({ deal_type: 'paid_deliverables' })).toEqual([]);
    expect(keys({ deal_type: 'appearance_plus_deliverables' })).toEqual(['appearance_fee']);
    expect(keys({ deal_type: 'performance_booking' })).toEqual(['performance_fee']);
    expect(keys({ deal_type: 'brand_partnership' })).toEqual(['partnership_base_fee']);
    expect(keys({ deal_type: 'brand_partnership', appearance_required: true })).toEqual(['partnership_base_fee', 'appearance_fee']);
    for (const t of ['self_funded', 'invited_comped', 'gifted']) expect(dealPlanFor({ deal_type: t })).toMatchObject({ components: [], cash: false });
    expect(dealPlanFor({ deal_type: 'gifted' }).giftedValue).toBe(true);
    expect(dealPlanFor({})).toMatchObject({ known: false, cash: false });
  });

  test('what Start Episode waits on (ruling 6)', () => {
    const ds = [{ id: 'd1', description: 'Reel', fee: 125 }, { id: 'd2', description: 'Host a Q&A', deliverable_type: 'other', fee: null }];
    expect(missingPriceLabels({ deal_type: 'brand_partnership', partnership_base_fee: null }, ds)).toEqual(['Partnership base', '"Host a Q&A"']);
    expect(missingPriceLabels({ deal_type: 'paid_deliverables' }, [{ ...ds[1], fee: 0 }])).toEqual([]);
    expect(missingPriceLabels({ deal_type: 'gifted' }, ds)).toEqual([]);
    expect(missingPriceLabels({ deal_type: null }, ds)).toEqual([]);
  });
});

describe('pricing (Task #2341)', () => {
  const drafted = (fee, draftedFee, fees = {}) => ({
    deal_type: 'appearance_plus_deliverables',
    appearance_fee: fee,
    canon_consequences: { automation: {
      pricing_version: 1,
      auto_drafted: { appearance_fee: 'pricing', deliverable_fees: 'pricing' },
      drafted_values: { appearance_fee: draftedFee, deliverable_fees: fees },
    } },
  });

  test('no recorded pricing version: the note never reads "pricing vnull"', () => {
    const ev = drafted(450, 450);
    delete ev.canon_consequences.automation.pricing_version;
    expect(describeComponentFee(ev, 'appearance_fee').note).toBe('Auto-drafted · pricing');
  });

  test('a component: Auto-drafted · pricing v1 while equal to the draft, Edited once changed, Price required when empty', () => {
    expect(describeComponentFee(drafted(450, 450), 'appearance_fee')).toEqual({ value: 450, label: '450 coins', note: 'Auto-drafted · pricing v1' });
    expect(describeComponentFee(drafted(500, 450), 'appearance_fee').note).toBe('Edited');
    expect(describeComponentFee({ partnership_base_fee: 1300 }, 'partnership_base_fee')).toEqual({ value: 1300, label: '1,300 coins', note: null });
    expect(describeComponentFee({}, 'performance_fee')).toEqual({ value: null, label: 'Price required', note: null });
  });

  test('the gifted value is recorded, never paid', () => {
    expect(describeGiftedValue({ gifted_value: 300 }).label).toBe('300 coins in gifts (not paid)');
    expect(describeGiftedValue({}).label).toBe('Not recorded');
  });

  test('deliverable fee: labelled per deliverable; Price required only on a deal that pays deliverables', () => {
    const ev = drafted(0, 0, { d1: 270 });
    expect(describeDeliverableFee(ev, { id: 'd1', fee: 270 })).toEqual({ value: 270, label: 'Fee 270 coins', note: 'Auto-drafted · pricing v1', priceRequired: false });
    expect(describeDeliverableFee(ev, { id: 'd1', fee: 300 }).note).toBe('Edited');
    expect(describeDeliverableFee(ev, { id: 'd2', fee: null })).toEqual({ value: null, label: 'Price required', note: null, priceRequired: true });
    expect(describeDeliverableFee({ deal_type: 'paid_appearance' }, { id: 'd2', fee: null })).toEqual({ value: null, label: null, note: null, priceRequired: false });
  });

  test('a component edit: a whole number, 0 or more, or empty for none', () => {
    expect(buildComponentFeeUpdate('partnership_base_fee', '900')).toEqual({ body: { partnership_base_fee: 900 } });
    expect(buildComponentFeeUpdate('appearance_fee', '')).toEqual({ body: { appearance_fee: null } });
    expect(buildComponentFeeUpdate('appearance_fee', '0')).toEqual({ body: { appearance_fee: 0 } });
    expect(buildComponentFeeUpdate('appearance_fee', '1.5').error).toBeTruthy();
    expect(buildComponentFeeUpdate('appearance_fee', '-1').error).toBeTruthy();
  });

  test('premium choices from the card; a premium with no percent is not usable', () => {
    const choices = premiumChoicesFrom({ premiums: { rush: { '48h': 10, '24h': 20 }, paid_ad: { whitelisting: null } } });
    expect(choices).toEqual([
      { kind: 'rush', label: 'Rush', options: [{ key: '48h', percent: 10, usable: true }, { key: '24h', percent: 20, usable: true }] },
      { kind: 'paid_ad', label: 'Paid ad', options: [{ key: 'whitelisting', percent: null, usable: false }] },
    ]);
    expect(premiumChoicesFrom(null)).toEqual([]);
  });

  test('the propose body lists only chosen premiums, per component and per line (ruling 3)', () => {
    expect(buildProposeBody({
      components: { appearance: { rush: '48h', usage: '' }, partnership_base: { exclusivity: '90d' } },
      deliverables: { d1: { exclusivity: '30d' }, d2: { rush: '' } },
    })).toEqual({ premiums: {
      appearance: [{ kind: 'rush', key: '48h' }],
      partnership_base: [{ kind: 'exclusivity', key: '90d' }],
      deliverables: { d1: [{ kind: 'exclusivity', key: '30d' }] },
    } });
    expect(buildProposeBody(undefined)).toEqual({ premiums: { deliverables: {} } });
  });
});

describe('drafted deliverables (D12, Task #2395)', () => {
  const record = { type: 'reel', fee: 125, description: 'Reel', required: true };
  const post = { type: 'post', fee: null, description: 'Post', required: true };
  const ev = (auto = 'deal') => ({
    deal_type: 'brand_partnership',
    canon_consequences: { automation: { auto_drafted: { deliverables: auto }, drafted_values: { deliverables: { d1: record, d2: post } } } },
  });
  const reel = { id: 'd1', deliverable_type: 'reel', fee: 125, description: 'Reel', required: true };
  const postRow = { id: 'd2', deliverable_type: 'post', fee: null, description: 'Post', required: true };

  test('reads Auto-drafted · from deal until edited', () => {
    expect(deliverableDraftNote(ev(), reel)).toBe('Auto-drafted · from deal');
    expect(deliverableDraftNote(ev(), postRow)).toBe('Auto-drafted · from deal');
  });

  test('an edit to its type, fee, description or required reads Edited', () => {
    expect(deliverableDraftNote(ev(), { ...reel, fee: 150 })).toBe('Edited');
    expect(deliverableDraftNote(ev(), { ...reel, fee: null })).toBe('Edited');
    expect(deliverableDraftNote(ev(), { ...reel, deliverable_type: 'post' })).toBe('Edited');
    expect(deliverableDraftNote(ev(), { ...reel, description: 'Reel in the coat' })).toBe('Edited');
    expect(deliverableDraftNote(ev(), { ...reel, required: false })).toBe('Edited');
    expect(deliverableDraftNote(ev(), { ...postRow, fee: 0 })).toBe('Edited');
  });

  test('a row never drafted, or an event with no deliverables draft, has no note', () => {
    expect(deliverableDraftNote(ev(), { ...reel, id: 'd9' })).toBeNull();
    expect(deliverableDraftNote(ev(null), reel)).toBeNull();
    expect(deliverableDraftNote({}, reel)).toBeNull();
  });
});

// ─── D14: deal components (2026-09-30) ───
import {
  componentsOf, isDealEvent, dealLabelFor, describeDealComponents, buildDealComponentsUpdate, DEAL_COMPONENT_KEYS,
} from './eventTerms';

describe('deal components (D14)', () => {
  test('the column wins; else the deal type through the map; null is legacy', () => {
    expect(componentsOf({ deal_components: ['performance_fee'], deal_type: 'performance_booking' })).toEqual(['performance_fee']);
    expect(componentsOf({ deal_components: '["gifted_items"]' })).toEqual(['gifted_items']);
    expect(componentsOf({ deal_type: 'brand_partnership', appearance_required: true })).toEqual(['paid_to_appear', 'paid_for_content', 'partnership_base']);
    expect(componentsOf({ deal_type: null })).toBeNull();
    expect(isDealEvent({ deal_components: [] })).toBe(true);
    expect(isDealEvent({})).toBe(false);
  });

  // The same table as tests/unit/utils/dealComponents.test.js (the server's dealLabel).
  test.each([
    [[], 'Self-funded'],
    [['entry_covered'], 'Invited, comped'],
    [['gifted_items'], 'Gifted'],
    [['gifted_items', 'entry_covered'], 'Gifted'],
    [['paid_to_appear'], 'Paid appearance'],
    [['paid_to_appear', 'entry_covered'], 'Paid appearance'],
    [['paid_for_content'], 'Paid content'],
    [['paid_to_appear', 'paid_for_content'], 'Appearance plus content'],
    [['performance_fee'], 'Performance booking'],
    [['performance_fee', 'paid_for_content'], 'Performance booking'],
    [['partnership_base', 'paid_for_content'], 'Brand partnership'],
    [['partnership_base'], 'Brand partnership (retainer)'],
    [['partnership_base', 'paid_to_appear', 'paid_for_content'], 'Brand partnership'],
    [['paid_to_appear', 'performance_fee'], 'Paid appearance + performance fee'],
    [['paid_to_appear', 'paid_for_content', 'gifted_items'], 'Appearance plus content + gifted'],
    [['paid_to_appear', 'paid_for_content', 'performance_fee'], 'Paid appearance + content + performance fee'],
  ])('%j reads "%s"', (components, label) => {
    expect(dealLabelFor(components)).toBe(label);
  });

  test('the plan follows the components: a retainer is cash with no paid content; appearance + performance pays both', () => {
    expect(dealPlanFor({ deal_components: ['partnership_base'] })).toMatchObject({ cash: true, deliverables: false, known: true });
    expect(dealPlanFor({ deal_components: ['paid_to_appear', 'performance_fee'] }).components.map((c) => c.field))
      .toEqual(['performance_fee', 'appearance_fee']);
    expect(dealPlanFor({ deal_components: ['gifted_items'] })).toMatchObject({ cash: false, giftedValue: true });
  });

  test('Auto-drafted while the ticks equal the drafted copy (or, before D14, the drafted deal type)', () => {
    const cc = (drafted) => ({ canon_consequences: { automation: { auto_drafted: { deal_type: 'rule' }, drafted_values: drafted } } });
    expect(describeDealComponents({ deal_type: 'invited_comped', ...cc({ deal_type: 'invited_comped' }) }))
      .toMatchObject({ label: 'Invited, comped', state: 'auto_drafted', note: 'Auto-drafted · rule' });
    expect(describeDealComponents({ deal_components: ['entry_covered', 'gifted_items'], ...cc({ deal_components: ['gifted_items', 'entry_covered'] }) }))
      .toMatchObject({ state: 'auto_drafted' });
    expect(describeDealComponents({ deal_components: ['gifted_items'], ...cc({ deal_components: ['gifted_items', 'entry_covered'] }) }))
      .toMatchObject({ state: 'edited', note: 'Edited' });
    expect(describeDealComponents({})).toMatchObject({ label: 'Not set', state: 'missing', note: null });
  });

  test('the PUT body: canonical order; unchanged when equal; an unknown key is refused', () => {
    expect(buildDealComponentsUpdate({ deal_type: 'paid_appearance' }, ['entry_covered', 'paid_to_appear']))
      .toEqual({ body: { deal_components: ['paid_to_appear', 'entry_covered'] }, unchanged: false, error: null });
    expect(buildDealComponentsUpdate({ deal_type: 'paid_appearance' }, ['paid_to_appear']).unchanged).toBe(true);
    expect(buildDealComponentsUpdate({}, ['vip']).error).toBe('Tick only the listed components.');
    expect(buildDealComponentsUpdate({ deal_components: [] }, null)).toEqual({ body: { deal_components: null }, unchanged: false, error: null });
    expect(DEAL_COMPONENT_KEYS).toHaveLength(6);
  });
});
