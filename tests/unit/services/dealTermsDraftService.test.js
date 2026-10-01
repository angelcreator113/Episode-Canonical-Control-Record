/**
 * The whole Terms section, drafted (ruling D13, Evoni 2026-09-30; answers
 * 1-13; docs/DEAL_COMPONENTS_DESIGN.md §4, §9). Build PR 5. The pure parts.
 */
const {
  suggestedBonus, cashTotalOf, draftRelationshipGoals, relationshipGoalTasks, deliverableIsAutoDrafted,
} = require('../../../src/services/dealTermsDraftService');
const { sizingFor, draftDeliverablesForDeal, draftedDeliverableTypes } = require('../../../src/services/dealPricingService');
const { componentsFromDealType } = require('../../../src/utils/dealComponents');
const { draftedCostLines, lalaTravels, missingCostPrices } = require('../../../src/services/eventCostsService');
const { readLalaHome, readLalaHomeBody, normCity } = require('../../../src/utils/lalaHome');
const { DEAL_TYPES } = require('../../../src/models/WorldEvent');

describe('deliverable sizing by components (§4.1)', () => {
  test('every deal type\'s backfilled components size exactly as D12 did', () => {
    for (const dealType of DEAL_TYPES) {
      for (const tier of [1, 3, 5]) {
        const keys = componentsFromDealType(dealType, dealType === 'brand_partnership');
        expect(draftedDeliverableTypes(sizingFor(keys), tier)).toEqual(draftedDeliverableTypes(dealType, tier));
      }
    }
  });

  test.each([
    [['paid_for_content'], 'paid_deliverables'],
    [['paid_for_content', 'paid_to_appear'], 'appearance_plus_deliverables'],
    [['paid_for_content', 'performance_fee'], 'appearance_plus_deliverables'],
    [['paid_for_content', 'partnership_base'], 'brand_partnership'],
    [['paid_to_appear'], 'paid_appearance'],
    [['performance_fee'], 'paid_appearance'],
    [['partnership_base'], null],
    [['gifted_items', 'entry_covered'], null],
    [[], null],
  ])('%j sizes like %s', (keys, sizing) => {
    expect(sizingFor(keys)).toBe(sizing);
  });

  test('a retainer drafts no deliverables; a performance booking without content drafts the optional Stories', () => {
    expect(draftDeliverablesForDeal({ deal_components: ['partnership_base'], career_tier: 4 })).toEqual([]);
    const perf = draftDeliverablesForDeal({ deal_components: ['performance_fee'], career_tier: 2 });
    expect(perf).toEqual([expect.objectContaining({ deliverable_type: 'instagram_stories', quantity: 3, required: false, fee: null })]);
  });
});

describe('the suggested bonus (answer 5)', () => {
  test('only with a partnership base or a performance fee', () => {
    expect(suggestedBonus(['partnership_base'], 1000)).toEqual({ slay: 200, pass: 100 });
    expect(suggestedBonus(['performance_fee', 'paid_for_content'], 800)).toEqual({ slay: 160, pass: 80 });
    expect(suggestedBonus(['paid_to_appear', 'paid_for_content'], 1000)).toBeNull();
    expect(suggestedBonus([], 1000)).toBeNull();
  });

  test('rounded to the nearest 5; no safe bonus; nothing on a 0 total', () => {
    expect(suggestedBonus(['partnership_base'], 333)).toEqual({ slay: 65, pass: 35 });
    expect(suggestedBonus(['partnership_base'], 0)).toBeNull();
    // 10 coins: slay 2 and pass 1 both round to 0, so nothing is suggested.
    expect(suggestedBonus(['partnership_base'], 10)).toBeNull();
  });

  test('the cash total is the paid components plus the paid deliverables', () => {
    const event = { deal_components: ['partnership_base', 'paid_for_content'], partnership_base_fee: 500, appearance_fee: 999 };
    expect(cashTotalOf(event, [{ fee: 200 }, { fee: 100, required: false }, { fee: null }])).toBe(700);
    expect(cashTotalOf({ deal_components: ['gifted_items'] }, [{ fee: 200 }])).toBe(0);
    expect(cashTotalOf({ deal_type: null }, [])).toBe(0);
  });
});

describe('relationship goals (answer 6)', () => {
  test('at most 2, from the host, the brand and the guests', () => {
    const event = {
      host: 'Celeste Rue', host_brand: 'Velour',
      canon_consequences: { automation: { guest_profiles: [{ display_name: 'Mira' }] } },
    };
    expect(draftRelationshipGoals(event)).toEqual([
      { slot: 'relationship_host', label: 'Follow up with Celeste Rue after the event', description: expect.any(String) },
      { slot: 'relationship_brand', label: 'Co-style a moment with Velour', description: expect.any(String) },
    ]);
    expect(draftRelationshipGoals({ host: 'Celeste Rue', canon_consequences: '{"automation":{"guest_profiles":[{"handle":"mira"}]}}' })
      .map((g) => g.slot)).toEqual(['relationship_host', 'relationship_guest']);
    expect(draftRelationshipGoals({})).toEqual([]);
  });

  test('Start Episode writes them as Lala\'s goals, never required', () => {
    const tasks = relationshipGoalTasks({ canon_consequences: { automation: { relationship_goals: [
      { slot: 'relationship_host', label: 'Follow up with Celeste', description: 'x' },
      { slot: 'relationship_brand', label: 'Co-style with Velour', description: 'y' },
      { slot: 'extra', label: 'A third' },
    ] } } });
    expect(tasks).toHaveLength(2);
    expect(tasks.every((t) => t.task_source === 'goal' && t.required === false && !t.deliverable_id)).toBe(true);
  });
});

describe('travel and accommodation (answer 7 and the travel ruling)', () => {
  test('drafted with no amount ("Price required", never 0), paid by Lala, only when Lala travels', () => {
    const deal = { deal_components: ['paid_to_appear'], cost_coins: 0 };
    expect(draftedCostLines(deal, { travels: false })).toEqual([]);
    expect(draftedCostLines(deal, { travels: true }).map((l) => [l.kind, l.amount, l.paid_by]))
      .toEqual([['travel', null, 'lala'], ['accommodation', null, 'lala']]);
    // Between DREAM cities: travel only; the stay is Lala's to add (Evoni, 2026-10-01).
    expect(draftedCostLines(deal, { travels: true, stays: false }).map((l) => l.kind)).toEqual(['travel']);
    expect(draftedCostLines(deal, { travels: true, stays: true }).map((l) => l.kind)).toEqual(['travel', 'accommodation']);
    // Without a city lookup, the fallback alone: the category travel_destination.
    expect(lalaTravels({ category: 'travel_destination' })).toBe(true);
    expect(draftedCostLines({ ...deal, category: 'travel_destination' })).toHaveLength(2);
    expect(draftedCostLines(deal)).toEqual([]);
    // A legacy event has no itemised costs.
    expect(draftedCostLines({ deal_type: null }, { travels: true })).toEqual([]);
  });

  test('a line Lala pays with no amount holds Start Episode; a comped one does not', () => {
    expect(missingCostPrices([
      { id: 'a', kind: 'travel', label: 'Travel', amount: null, paid_by: 'lala' },
      { id: 'b', kind: 'accommodation', label: 'Accommodation', amount: null, paid_by: 'brand' },
      { id: 'c', kind: 'entry', label: 'Entry', amount: 0, paid_by: 'lala' },
    ])).toEqual([{ kind: 'cost', key: 'a', label: '"Travel"' }]);
  });
});

describe('Lala\'s home (the travel ruling)', () => {
  test('the setting needs a city; every field is text', () => {
    expect(readLalaHome({ lala_home: { address: '246 Olddy Paveway Ln', neighbourhood: 'Echo Park', city: 'Los Angeles' } }))
      .toEqual({ address: '246 Olddy Paveway Ln', neighbourhood: 'Echo Park', city: 'Los Angeles' });
    expect(readLalaHome('{"lala_home":{"city":"Los Angeles"}}').city).toBe('Los Angeles');
    expect(readLalaHome({ lala_home: { address: 'x' } })).toBeNull();
    expect(readLalaHome(null)).toBeNull();
    expect(readLalaHomeBody({ city: ' ' }).error).toMatch(/city is required/);
    expect(readLalaHomeBody({ city: 'Los Angeles', neighbourhood: 'Echo Park' }).value)
      .toEqual({ address: null, neighbourhood: 'Echo Park', city: 'Los Angeles' });
  });

  test('cities compare without case or spacing', () => {
    expect(normCity('  los   Angeles ')).toBe(normCity('Los Angeles'));
  });
});

describe('deliverableIsAutoDrafted (rule 14)', () => {
  test('equal to its record, else Edited', () => {
    const record = { type: 'instagram_reel', platform: 'instagram', quantity: 1, fee: 125, description: 'Instagram Reel', required: true };
    const row = { deliverable_type: 'instagram_reel', platform: 'instagram', quantity: 1, fee: 125, description: 'Instagram Reel', required: true };
    expect(deliverableIsAutoDrafted(row, record)).toBe(true);
    expect(deliverableIsAutoDrafted({ ...row, fee: 150 }, record)).toBe(false);
    expect(deliverableIsAutoDrafted(row, undefined)).toBe(false);
  });
});
