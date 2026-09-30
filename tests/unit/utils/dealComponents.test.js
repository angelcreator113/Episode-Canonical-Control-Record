/**
 * Deal components (ruling D14, Evoni 2026-09-30; answers 1–4;
 * docs/DEAL_COMPONENTS_DESIGN.md §3, §9).
 */
const {
  DEAL_COMPONENT_KEYS, readComponents, componentsFromDealType, componentsOf, isDealEvent,
  dealPlanOf, dealLabel, dealTypeFromComponents, COMPONENTS_BY_DEAL_TYPE,
} = require('../../../src/utils/dealComponents');
const { DEAL_PLANS, dealComponents } = require('../../../src/services/dealPricingService');
const { DEAL_TYPES } = require('../../../src/models/WorldEvent');

describe('the six components (D14)', () => {
  test('keys, in display order', () => {
    expect(DEAL_COMPONENT_KEYS).toEqual(['paid_to_appear', 'paid_for_content', 'partnership_base', 'performance_fee', 'gifted_items', 'entry_covered']);
  });

  test('a body value: known keys only, deduplicated, canonical order; null clears', () => {
    expect(readComponents(['entry_covered', 'gifted_items', 'gifted_items'])).toEqual({ value: ['gifted_items', 'entry_covered'] });
    expect(readComponents([])).toEqual({ value: [] });
    expect(readComponents(null)).toEqual({ value: null });
    expect(readComponents(['paid_to_appear', 'vip']).error).toMatch(/unknown deal component\(s\): vip/);
    expect(readComponents('paid_to_appear').error).toMatch(/must be an array/);
  });
});

describe('the backfill is one-to-one and changes no money (design note §3.3)', () => {
  test('every deal type maps', () => {
    expect(Object.keys(COMPONENTS_BY_DEAL_TYPE).sort()).toEqual([...DEAL_TYPES].sort());
  });

  test('each deal type\'s plan equals DEAL_PLANS (with the appearance a partnership requires)', () => {
    for (const dealType of DEAL_TYPES) {
      for (const appearanceRequired of [false, true]) {
        const event = { deal_type: dealType, appearance_required: appearanceRequired };
        const plan = dealPlanOf(event);
        const old = DEAL_PLANS[dealType];
        const oldComponents = [...old.components, ...(old.appearanceIfRequired && appearanceRequired ? ['appearance'] : [])];
        expect(plan.components).toEqual(oldComponents);
        expect(plan.deliverables).toBe(old.deliverables);
        expect(plan.cash).toBe(old.cash);
        expect(plan.giftedValue).toBe(Boolean(old.giftedValue));
        expect(dealComponents(event)).toEqual(oldComponents);
      }
    }
  });

  test('the derived deal_type of a backfilled deal is the deal type it came from', () => {
    for (const dealType of DEAL_TYPES) {
      expect(dealTypeFromComponents(componentsFromDealType(dealType)).deal_type).toBe(dealType);
    }
    expect(dealTypeFromComponents(componentsFromDealType('brand_partnership', true)))
      .toEqual({ deal_type: 'brand_partnership', appearance_required: true });
  });
});

describe('componentsOf: the column, else the deal type, else legacy', () => {
  test('stored components win; a JSON string is read', () => {
    expect(componentsOf({ deal_components: ['performance_fee'], deal_type: 'performance_booking' })).toEqual(['performance_fee']);
    expect(componentsOf({ deal_components: '["gifted_items"]' })).toEqual(['gifted_items']);
    expect(componentsOf({ deal_components: [] })).toEqual([]);
  });

  test('before the column: the deal type through the map; null is legacy', () => {
    expect(componentsOf({ deal_type: 'invited_comped' })).toEqual(['entry_covered']);
    expect(componentsOf({ deal_type: null })).toBeNull();
    expect(isDealEvent({ deal_type: null, deal_components: null })).toBe(false);
    expect(isDealEvent({ deal_components: [] })).toBe(true);
  });
});

describe('independent components (answers 1 and 4)', () => {
  test('a performance booking without paid content does not pay deliverables', () => {
    expect(dealPlanOf(['performance_fee'])).toMatchObject({ components: ['performance'], deliverables: false, cash: true });
  });

  test('a retainer: partnership base without paid content', () => {
    expect(dealPlanOf(['partnership_base'])).toMatchObject({ components: ['partnership_base'], deliverables: false, cash: true });
  });

  test('gifted does not imply entry covered; both can be ticked', () => {
    expect(dealPlanOf(['gifted_items'])).toMatchObject({ giftedValue: true, entryCovered: false, cash: false });
    expect(dealPlanOf(['gifted_items', 'entry_covered'])).toMatchObject({ giftedValue: true, entryCovered: true });
  });

  test('a new combination pays each money component once', () => {
    expect(dealPlanOf(['paid_to_appear', 'performance_fee']).components).toEqual(['performance', 'appearance']);
  });
});

describe('the derived label (§3.2; answer 2: join the parts)', () => {
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
    expect(dealLabel(components)).toBe(label);
  });

  test('legacy has no label', () => {
    expect(dealLabel({ deal_type: null })).toBeNull();
  });
});

describe('the derived deal_type copy for a new combination', () => {
  test.each([
    [['paid_to_appear', 'performance_fee'], 'performance_booking'],
    [['partnership_base'], 'brand_partnership'],
    [['gifted_items', 'entry_covered'], 'gifted'],
    [['paid_to_appear', 'gifted_items'], 'paid_appearance'],
  ])('%j → %s', (components, dealType) => {
    expect(dealTypeFromComponents(components).deal_type).toBe(dealType);
  });

  test('null components are legacy', () => {
    expect(dealTypeFromComponents(null)).toEqual({ deal_type: null, appearance_required: false });
  });
});
