'use strict';

/**
 * Deal components (ruling D14, Evoni, 2026-09-30; answers 1–4 and 2 of the
 * same day; docs/DEAL_COMPONENTS_DESIGN.md §3, §9). Build PR 2 of that note.
 *
 * "A deal can combine components: Evoni ticks what it includes (paid to
 * appear, paid for content, partnership base, performance fee, gifted
 * items, entry covered), and the deal's label is derived from the
 * combination."
 *
 * Answer 1: "Components are independent: gifted does not imply entry
 * covered, and a performance booking does not imply paid content."
 * Answer 4: a partnership base can be ticked without paid content (a
 * retainer).
 *
 * world_events.deal_components (JSONB array of keys) is the source of truth:
 *   null — a legacy event (no deal, D8)
 *   []   — a deal where Lala pays her own way (self-funded)
 * world_events.deal_type stays for one release as a derived copy
 * (dealTypeFromComponents), written from the components on every save, so
 * a rollback still reads a deal; a later migration drops it. An event
 * written before the column has only deal_type; componentsOf reads it
 * through the one-to-one backfill map (componentsFromDealType).
 *
 * The Event Package still edits deal_type until build PR 3 adds the
 * component checkboxes (and a client mirror of this file).
 */

// In display (and label) order.
const DEAL_COMPONENT_KEYS = Object.freeze([
  'paid_to_appear', 'paid_for_content', 'partnership_base', 'performance_fee', 'gifted_items', 'entry_covered',
]);

const DEAL_COMPONENT_LABELS = Object.freeze({
  paid_to_appear: 'Paid to appear',
  paid_for_content: 'Paid for content',
  partnership_base: 'Partnership base',
  performance_fee: 'Performance fee',
  gifted_items: 'Gifted items',
  entry_covered: 'Entry covered',
});

// The components that pay cash (design note §3.1): a bonus and content fees
// need one of them, as they needed a cash deal type.
const CASH_COMPONENTS = Object.freeze(['paid_to_appear', 'paid_for_content', 'partnership_base', 'performance_fee']);

// The fee components (dealPricingService.EVENT_COMPONENTS keys) each ticked
// component carries, in the order the Terms list them.
const FEE_COMPONENT_OF = Object.freeze({
  partnership_base: 'partnership_base',
  performance_fee: 'performance',
  paid_to_appear: 'appearance',
});

// The one-to-one backfill (design note §3.3): each deal type is exactly
// what it did. A brand partnership that required an appearance also ticks
// paid_to_appear.
const COMPONENTS_BY_DEAL_TYPE = Object.freeze({
  self_funded: [],
  invited_comped: ['entry_covered'],
  gifted: ['gifted_items'],
  paid_appearance: ['paid_to_appear'],
  paid_deliverables: ['paid_for_content'],
  appearance_plus_deliverables: ['paid_to_appear', 'paid_for_content'],
  performance_booking: ['performance_fee', 'paid_for_content'],
  brand_partnership: ['partnership_base', 'paid_for_content'],
});

const TRUE_LIKE = new Set([true, 'true', 1, '1']);

/** Known keys only, once each, in canonical order. */
function normalizeComponents(list) {
  const set = new Set(Array.isArray(list) ? list : []);
  return DEAL_COMPONENT_KEYS.filter((k) => set.has(k));
}

/**
 * Validates a components body value: an array of known keys (or null to
 * clear the deal). Returns { value } or { error }.
 */
function readComponents(value) {
  if (value === null) return { value: null };
  if (!Array.isArray(value)) return { error: 'deal_components must be an array of component keys, or null' };
  const unknown = value.filter((k) => !DEAL_COMPONENT_KEYS.includes(k));
  if (unknown.length) return { error: `unknown deal component(s): ${unknown.join(', ')}; allowed: ${DEAL_COMPONENT_KEYS.join(', ')}` };
  return { value: normalizeComponents(value) };
}

/** The backfill map; null for an unknown or empty deal type. */
function componentsFromDealType(dealType, appearanceRequired = false) {
  const base = COMPONENTS_BY_DEAL_TYPE[dealType];
  if (!base) return null;
  const list = [...base];
  if (dealType === 'brand_partnership' && TRUE_LIKE.has(appearanceRequired)) list.push('paid_to_appear');
  return normalizeComponents(list);
}

function parseArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch (err) {
      console.error('[DealComponents] deal_components is not JSON:', err.message);
      return null;
    }
  }
  return null;
}

/**
 * The event's components: deal_components when set, else read from its
 * deal_type (an event written before the column), else null (legacy).
 */
function componentsOf(event) {
  const stored = parseArray(event?.deal_components);
  if (stored) return normalizeComponents(stored);
  return componentsFromDealType(event?.deal_type, event?.appearance_required);
}

function isDealEvent(event) {
  return componentsOf(event) !== null;
}

/**
 * The plan the pricing, payout, cost and invitation code reads (it replaces
 * dealPricingService.DEAL_PLANS[deal_type]):
 *   { components: [fee component keys], deliverables, cash, giftedValue,
 *     entryCovered, selfFunded, keys }
 * or null for a legacy event.
 */
function dealPlanOf(componentsOrEvent) {
  const keys = Array.isArray(componentsOrEvent) ? normalizeComponents(componentsOrEvent) : componentsOf(componentsOrEvent);
  if (!keys) return null;
  const has = (k) => keys.includes(k);
  return {
    components: ['partnership_base', 'performance_fee', 'paid_to_appear'].filter(has).map((k) => FEE_COMPONENT_OF[k]),
    deliverables: has('paid_for_content'),
    cash: CASH_COMPONENTS.some(has),
    giftedValue: has('gifted_items'),
    entryCovered: has('entry_covered'),
    selfFunded: keys.length === 0,
    keys,
  };
}

/**
 * The derived label (design note §3.2, answer 2 "join the parts"; answer 4
 * the retainer). Today's names are kept where a combination matches one.
 */
function dealLabel(componentsOrEvent) {
  const keys = Array.isArray(componentsOrEvent) ? normalizeComponents(componentsOrEvent) : componentsOf(componentsOrEvent);
  if (!keys) return null;
  const has = (k) => keys.includes(k);
  const money = keys.filter((k) => k !== 'entry_covered' && k !== 'gifted_items');
  const gifted = has('gifted_items');
  if (keys.length === 0) return 'Self-funded';
  if (money.length === 0) {
    if (gifted) return 'Gifted';
    return 'Invited, comped';
  }
  const withGifted = (label) => (gifted ? `${label} + gifted` : label);
  if (has('partnership_base')) {
    if (money.length === 1) return withGifted('Brand partnership (retainer)');
    return withGifted('Brand partnership');
  }
  const key = money.join('+');
  const named = {
    paid_to_appear: 'Paid appearance',
    paid_for_content: 'Paid content',
    'paid_to_appear+paid_for_content': 'Appearance plus content',
    performance_fee: 'Performance booking',
    'paid_for_content+performance_fee': 'Performance booking',
  }[key];
  if (named) return withGifted(named);
  const PART = {
    paid_to_appear: 'Paid appearance', paid_for_content: 'content', performance_fee: 'performance fee',
  };
  return withGifted(money.map((k, i) => (i === 0 ? PART[k] : PART[k].toLowerCase())).join(' + '));
}

/**
 * The derived deal_type copy written with the components (design note
 * §3.3): the exact type where the combination is one, else the nearest by
 * the precedence partnership > performance > appearance(+content) >
 * content > gifted > comped > self-funded. Returns { deal_type,
 * appearance_required }, or both null for legacy.
 */
function dealTypeFromComponents(components) {
  if (components == null) return { deal_type: null, appearance_required: false };
  const keys = normalizeComponents(components);
  const has = (k) => keys.includes(k);
  let dealType;
  if (has('partnership_base')) dealType = 'brand_partnership';
  else if (has('performance_fee')) dealType = 'performance_booking';
  else if (has('paid_to_appear') && has('paid_for_content')) dealType = 'appearance_plus_deliverables';
  else if (has('paid_to_appear')) dealType = 'paid_appearance';
  else if (has('paid_for_content')) dealType = 'paid_deliverables';
  else if (has('gifted_items')) dealType = 'gifted';
  else if (has('entry_covered')) dealType = 'invited_comped';
  else dealType = 'self_funded';
  return { deal_type: dealType, appearance_required: dealType === 'brand_partnership' && has('paid_to_appear') };
}

module.exports = {
  DEAL_COMPONENT_KEYS,
  DEAL_COMPONENT_LABELS,
  CASH_COMPONENTS,
  COMPONENTS_BY_DEAL_TYPE,
  normalizeComponents,
  readComponents,
  componentsFromDealType,
  componentsOf,
  isDealEvent,
  dealPlanOf,
  dealLabel,
  dealTypeFromComponents,
};
