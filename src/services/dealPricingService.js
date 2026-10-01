'use strict';

/**
 * Deal pricing (deal build PR 3; docs/DEAL_DESIGN.md §3.2, §11.1, §12;
 * Task #2341).
 *
 * Evoni's answer to QUESTION 4 (docs/EVENT_EPISODE_FLOW.md §8(cc)): "Rates
 * are baselines, not fixed payouts." Her Deal PR 3 ruling (2026-09-30, the
 * same section) sets how a deal is assembled; each numbered point is cited
 * where it is built:
 *
 *   1. The brand partnership base is its own component, not an appearance
 *      fee; the deliverables are priced on top; the appearance anchor is
 *      added separately only when the partnership requires an appearance.
 *   2. Deliverables use a fixed typed list. Appearance is not a
 *      deliverable. No price depends on words in free text. Since D15
 *      (2026-09-30) the list is the influencer formats in
 *      src/utils/deliverableFormats.js, each with its anchor on the rate card
 *      (v2); only Other is priced by hand.
 *   3. Premiums on one component add up (+10% and +15% is +25%) and apply
 *      only to that component.
 *   4. The deal type decides the components (DEAL_PLANS). Since D14
 *      (2026-09-30) the deal's ticked components do: planFor(event) reads
 *      world_events.deal_components (src/utils/dealComponents.js), falling
 *      back to deal_type for an event written before the column.
 *   5. The rate card is data (deal_rate_anchors / deal_rate_premiums); the
 *      editor is a later PR.
 *   6. "Other" is never priced automatically: "Price required", and Start
 *      Episode refuses until it has a price. "Missing is missing."
 *
 * proposeTerms is pure. The route writes its numbers onto the deal as a
 * draft Evoni edits until the terms lock; payouts (PR 5) read the event's
 * stored numbers, never the card.
 *
 * missingPrices is pure too: the priced components and deliverables of a
 * deal that still have no number. Start Episode refuses while it is not
 * empty (episodeGeneratorService.generateEpisodeFromEvent).
 */

const { DELIVERABLE_TYPE_LABELS } = require('./eventTermsService');
const {
  DELIVERABLE_FORMATS, formatOf, formatAnchorPrice, deliverableTypeLabel,
} = require('../utils/deliverableFormats');

const {
  dealPlanOf, dealTypeFromComponents,
} = require('../utils/dealComponents');

const PRICING_SOURCE = 'pricing';

// The event-level components (ruling 1 and 4): each is its own column, with
// its own anchor on the rate card.
const EVENT_COMPONENTS = Object.freeze({
  appearance: { field: 'appearance_fee', anchor: 'paid_appearance', label: 'Appearance fee' },
  partnership_base: { field: 'partnership_base_fee', anchor: 'brand_partnership_base', label: 'Partnership base' },
  performance: { field: 'performance_fee', anchor: 'performance_booking', label: 'Performance fee' },
});

// Ruling 4: which components each deal type has, and whether its
// deliverables are priced. brand_partnership adds the appearance only when
// the event's appearance_required is true (ruling 1).
const DEAL_PLANS = Object.freeze({
  self_funded: { components: [], deliverables: false, cash: false },
  invited_comped: { components: [], deliverables: false, cash: false },
  gifted: { components: [], deliverables: false, cash: false, giftedValue: true },
  paid_appearance: { components: ['appearance'], deliverables: false, cash: true },
  paid_deliverables: { components: [], deliverables: true, cash: true },
  appearance_plus_deliverables: { components: ['appearance'], deliverables: true, cash: true },
  performance_booking: { components: ['performance'], deliverables: true, cash: true },
  brand_partnership: { components: ['partnership_base'], deliverables: true, cash: true, appearanceIfRequired: true },
});

// Ruling 2 as D15 extends it: each format's anchor component on the rate
// card. Other and any untyped row are priced by hand. How the anchor turns
// into a price (per piece, per slide, per started week) is
// deliverableFormats.formatAnchorPrice.
const DELIVERABLE_ANCHORS = Object.freeze(Object.fromEntries(
  Object.entries(DELIVERABLE_FORMATS).filter(([, f]) => f.anchor).map(([k, f]) => [k, f.anchor])
));



/**
 * The event's plan (D14): { components, deliverables, cash, giftedValue,
 * entryCovered, selfFunded, keys } from its ticked components, or null for
 * a legacy event. For every deal type it equals DEAL_PLANS (with the
 * appearance when a partnership requires it), because the backfill is
 * one-to-one.
 */
function planFor(event) {
  return dealPlanOf(event);
}

/** The fee component keys the event's deal carries, in display order. */
function dealComponents(event) {
  return planFor(event)?.components || [];
}

function tierOf(careerTier) {
  const n = Math.trunc(Number(careerTier));
  return n >= 1 && n <= 5 ? n : 1;
}

function deliverableName(d) {
  return `"${d?.description || deliverableTypeLabel(d) || 'Deliverable'}"`;
}

/** Why a deliverable has no automatic price, for "Price required". */
function manualPriceReason(d) {
  const type = d?.deliverable_type;
  if (type === 'other') return 'Other is never priced automatically';
  if (DELIVERABLE_TYPE_LABELS[type]) return `${DELIVERABLE_TYPE_LABELS[type]} is priced by hand`;
  return 'no type is chosen';
}

/**
 * The rate card as { version, anchors: {component: {tier: amount|null}},
 * premiums: {kind: {key: percent|null}} }. Pure shape; loadRateCard fills it.
 */
function rateCardFrom(version, anchorRows, premiumRows) {
  const anchors = {};
  for (const r of anchorRows || []) {
    (anchors[r.component] ||= {})[r.career_tier] = r.amount == null ? null : Number(r.amount);
  }
  const premiums = {};
  for (const r of premiumRows || []) {
    (premiums[r.kind] ||= {})[r.key] = r.percent == null ? null : Number(r.percent);
  }
  return { version, anchors, premiums };
}

/** The newest rate card version (the highest with anchor rows), or null. */
async function loadRateCard(sequelize, { transaction } = {}) {
  const [[latest]] = await sequelize.query(
    'SELECT MAX(version) AS version FROM deal_rate_anchors WHERE deleted_at IS NULL', { transaction });
  const version = latest?.version == null ? null : Number(latest.version);
  if (version == null) return null;
  const [anchors] = await sequelize.query(
    `SELECT component, career_tier, amount FROM deal_rate_anchors
      WHERE version = :version AND deleted_at IS NULL`, { replacements: { version }, transaction });
  const [premiums] = await sequelize.query(
    `SELECT kind, key, percent FROM deal_rate_premiums
      WHERE version = :version AND deleted_at IS NULL`, { replacements: { version }, transaction });
  return rateCardFrom(version, anchors, premiums);
}

/**
 * Ruling 3: the premiums chosen for one component add up (never compound),
 * and the component is rounded once to whole Prime Coins. Returns
 * { amount, applied, errors }. choices: [{ kind, key }], each on the card
 * with a percent, one per kind.
 */
function applyPremiums(base, choices, card, label) {
  const applied = [];
  const errors = [];
  let percent = 0;
  const seenKinds = new Set();
  for (const c of Array.isArray(choices) ? choices : []) {
    const kind = c?.kind; const key = c?.key;
    if (seenKinds.has(kind)) { errors.push(`${label}: only one ${kind} premium applies`); continue; }
    const row = card.premiums?.[kind];
    if (!row || !Object.prototype.hasOwnProperty.call(row, key)) {
      errors.push(`${label}: no ${kind} premium "${key}" on rate card v${card.version}`);
      continue;
    }
    if (row[key] == null) {
      errors.push(`${label}: the ${kind} premium "${key}" has no percent yet (set before use)`);
      continue;
    }
    seenKinds.add(kind);
    percent += row[key];
    applied.push({ kind, key, percent: row[key] });
  }
  return { amount: Math.round(base * (1 + percent / 100)), applied, errors };
}

const hasChoices = (list) => Array.isArray(list) && list.length > 0;

// ─── Drafted deliverables (ruling D12, Evoni, 2026-09-30; Task #2395) ────
// "Propose terms drafts deliverables from the deal type, scaled to the job:
// comped/invited/gifted none required; paid appearance attendance only,
// optionally one Story set; paid deliverables 1–3 pieces, more at higher
// tiers or fees; brand partnership a package (Reel + Story set, a Post at
// higher tiers). Auto-drafted, editable, priced from the rate anchors."
//
// The mapping, by the event's career tier (1 Emerging, 2 Rising,
// 3 Established, 4 Influential, 5 Elite). The tier is the signal: before
// the draft a deliverables deal has no fee of its own to scale by.
//   self_funded, invited_comped, gifted     none
//   paid_appearance                         Story Set (3), optional (every tier)
//   paid_deliverables                       T1–2 Reel; T3 Reel + Story Set;
//                                           T4–5 Reel + Story Set + Post
//   appearance_plus_deliverables,           one piece fewer than paid
//   performance_booking                     deliverables, at least one:
//                                           T1–3 Reel; T4–5 Reel + Story Set
//   brand_partnership                       Reel + Story Set; T4–5 add a Post
// INFERRED (D12 does not say): the tier cut-offs; the optional Story Set as
// required: false; the two deal types D12 does not name; "higher tiers"
// read as Influential and Elite for both the Post and the third piece.
const DRAFTED_DELIVERABLES_SOURCE = 'deal';

// D15 (2026-09-30): the pieces are drafted in the new formats: a Reel is an
// Instagram Reel, a Story Set (3) is Instagram Stories ×3, a Post is an
// Instagram post (answer 8). D13's drafting (a later PR) supersedes this.
const REEL = { type: 'instagram_reel' };
const STORIES = { type: 'instagram_stories', quantity: 3 };
const POST = { type: 'instagram_post' };

/** D12's mapping: [{ type, quantity?, required? }] for a deal type at a tier. Pure. */
function draftedDeliverableTypes(dealType, tier) {
  const t = tierOf(tier);
  switch (dealType) {
    case 'paid_appearance':
      return [{ ...STORIES, required: false }];
    case 'paid_deliverables':
      if (t <= 2) return [REEL];
      if (t === 3) return [REEL, STORIES];
      return [REEL, STORIES, POST];
    case 'appearance_plus_deliverables':
    case 'performance_booking':
      return t <= 3 ? [REEL] : [REEL, STORIES];
    case 'brand_partnership':
      return t <= 3 ? [REEL, STORIES] : [REEL, STORIES, POST];
    default:
      return [];
  }
}

/**
 * D12: the deliverables Propose terms drafts for a deal. Pure.
 *   event: { deal_type, career_tier }
 *   tier:  overrides event.career_tier
 *   card:  the rate card (loadRateCard); without one no fee is drafted.
 * Returns [{ deliverable_type, platform, quantity, description, required,
 * owed_to, fee }]. The fee is the format's anchor price at the tier (D15)
 * on a deal that pays its deliverables (rulings 2 and 4); null otherwise:
 * "Price required" when the card has no anchor there, and no fee at all on
 * a paid appearance, which does not pay deliverables. owed_to is the brand on a
 * brand partnership and the host otherwise (the hand-entry default), so a
 * draft never re-drafts an Auto-drafted deal type (dealTypeDraftService's
 * rule 2 reads brand-owed deliverables).
 */
function draftDeliverablesForDeal(event, { tier, card } = {}) {
  const plan = planFor(event);
  if (!plan) return [];
  // D12's mapping is by deal type; since D14 that is the type the
  // components derive (dealTypeFromComponents). D13 replaces this drafting.
  const dealType = dealTypeFromComponents(plan.keys).deal_type;
  const t = tierOf(tier ?? event?.career_tier);
  const owedTo = plan.keys.includes('partnership_base') ? 'brand' : 'host';
  return draftedDeliverableTypes(dealType, t).map(({ type, quantity, required = true }) => {
    const format = formatOf(type);
    const row = {
      deliverable_type: type,
      platform: format.platforms[0] || null,
      quantity: quantity || format.defaultQuantity,
    };
    const price = plan.deliverables ? formatAnchorPrice(row, t, card) : null;
    return {
      ...row,
      description: deliverableTypeLabel(row),
      required,
      owed_to: owedTo,
      fee: price == null ? null : price,
    };
  });
}

/**
 * The proposal for one event.
 *   event:        { deal_type, career_tier, appearance_required }
 *   deliverables: [{ id, description, deliverable_type }]
 *   premiums:     { appearance?, partnership_base?, performance?: [{kind,key}],
 *                   deliverables?: { <id>: [{kind,key}] } }
 * Returns { ok, error?, pricing_version, career_tier, deal_type, cash,
 * components: { <key>: { field, anchor_component, anchor, fee, premiums, note } },
 * deliverables: [{ id, component, anchor, fee, premiums, note, price_required }],
 * gaps, note }. A fee of null is "Price required" (ruling 6): gaps say why.
 */
function proposeTerms({ event, deliverables = [], premiums = {}, card }) {
  const plan = planFor(event);
  if (!plan) {
    return event?.deal_type
      ? { ok: false, error: `Unknown deal type "${event.deal_type}".` }
      : { ok: false, error: 'Choose a deal type before proposing terms.' };
  }
  const dealType = dealTypeFromComponents(plan.keys).deal_type;
  if (!card) return { ok: false, error: 'There is no rate card yet, so no terms can be proposed.' };

  const tier = tierOf(event.career_tier);
  const gaps = [];
  const errors = [];
  const componentKeys = dealComponents(event);
  const chosen = premiums && typeof premiums === 'object' ? premiums : {};

  // Ruling 3: a premium never reaches a component the deal does not have.
  for (const key of Object.keys(EVENT_COMPONENTS)) {
    if (!componentKeys.includes(key) && hasChoices(chosen[key])) {
      errors.push(`${EVENT_COMPONENTS[key].label}: this deal has no such component, so no premium applies to it.`);
    }
  }

  const components = {};
  for (const key of componentKeys) {
    const spec = EVENT_COMPONENTS[key];
    const anchor = card.anchors?.[spec.anchor]?.[tier];
    if (anchor == null) {
      const note = `${spec.label}: price required (${spec.anchor} is not offered at tier ${tier}).`;
      gaps.push(note);
      if (hasChoices(chosen[key])) errors.push(`${spec.label}: no anchor at tier ${tier}, so no premium applies.`);
      components[key] = { field: spec.field, anchor_component: spec.anchor, anchor: null, fee: null, premiums: [], note };
      continue;
    }
    const priced = applyPremiums(anchor, chosen[key], card, spec.label);
    errors.push(...priced.errors);
    components[key] = { field: spec.field, anchor_component: spec.anchor, anchor, fee: priced.amount, premiums: priced.applied, note: null };
  }

  const chosenForLines = chosen.deliverables && typeof chosen.deliverables === 'object' ? chosen.deliverables : {};
  const lines = (Array.isArray(deliverables) ? deliverables : []).map((d) => {
    if (!plan.deliverables) {
      if (hasChoices(chosenForLines[d.id])) errors.push(`${deliverableName(d)}: this deal does not pay its deliverables, so no premium applies.`);
      return { id: d.id, component: null, anchor: null, fee: null, premiums: [], note: 'Not paid for this deal type.', price_required: false };
    }
    const component = DELIVERABLE_ANCHORS[d.deliverable_type] || null;
    const anchor = component ? formatAnchorPrice(d, tier, card) : null;
    if (anchor == null) {
      const reason = component ? `${component} is not offered at tier ${tier}` : manualPriceReason(d);
      const note = `${deliverableName(d)}: price required (${reason}).`;
      gaps.push(note);
      if (hasChoices(chosenForLines[d.id])) errors.push(`${deliverableName(d)}: no rate anchor, so no premium applies.`);
      return { id: d.id, component, anchor: null, fee: null, premiums: [], note, price_required: true };
    }
    const priced = applyPremiums(anchor, chosenForLines[d.id], card, deliverableName(d));
    errors.push(...priced.errors);
    return { id: d.id, component, anchor, fee: priced.amount, premiums: priced.applied, note: null, price_required: false };
  });

  if (errors.length) return { ok: false, error: errors.join(' '), errors };

  let note = null;
  if (!plan.cash) {
    note = plan.giftedValue
      ? 'Gifted: no cash income. Record the gifted value on the deal.'
      : 'No cash income for this deal type.';
  }
  return {
    ok: true, pricing_version: card.version, career_tier: tier, deal_type: dealType, deal_components: plan.keys, cash: plan.cash,
    components, deliverables: lines, gaps, note,
  };
}

/**
 * Ruling 6, "Missing is missing": every priced component and every paid
 * deliverable of the deal that still has no number. [] for a legacy event
 * (no deal type) and for deal types with no cash income.
 * Returns [{ kind: 'component' | 'deliverable', key, label }].
 */
function missingPrices(event, deliverables = []) {
  const plan = planFor(event);
  if (!plan || !plan.cash) return [];
  const missing = [];
  for (const key of dealComponents(event)) {
    const spec = EVENT_COMPONENTS[key];
    if (event[spec.field] == null) missing.push({ kind: 'component', key: spec.field, label: spec.label });
  }
  if (plan.deliverables) {
    for (const d of Array.isArray(deliverables) ? deliverables : []) {
      if (d?.fee == null) missing.push({ kind: 'deliverable', key: d.id, label: deliverableName(d) });
    }
  }
  return missing;
}

/** missingPrices for a stored event, read from the database. */
async function findMissingPrices(sequelize, eventId, { transaction } = {}) {
  const [rows] = await sequelize.query(
    `SELECT id, deal_type, deal_components, appearance_fee, partnership_base_fee, performance_fee, appearance_required
       FROM world_events WHERE id = :eventId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { eventId }, transaction }
  );
  const event = rows?.[0];
  if (!event || !planFor(event)?.cash) return [];
  const [deliverables] = await sequelize.query(
    `SELECT id, description, deliverable_type, fee FROM event_deliverables
      WHERE event_id = :eventId AND deleted_at IS NULL ORDER BY created_at ASC`,
    { replacements: { eventId }, transaction }
  );
  return missingPrices(event, deliverables);
}

const DEAL_PRICE_REQUIRED_CODE = 'DEAL_PRICE_REQUIRED';

function dealPriceRequiredError(missing) {
  const err = new Error(`Price required before Start Episode: ${missing.map((m) => m.label).join(', ')}.`);
  err.code = DEAL_PRICE_REQUIRED_CODE;
  err.missing = missing;
  return err;
}

/** The 409 JSON body for a refused Start Episode. */
function dealPriceRequiredBody(err) {
  return { success: false, code: DEAL_PRICE_REQUIRED_CODE, error: err.message, missing: err.missing || [] };
}

module.exports = {
  PRICING_SOURCE,
  DRAFTED_DELIVERABLES_SOURCE,
  EVENT_COMPONENTS,
  DEAL_PLANS,
  planFor,
  DELIVERABLE_ANCHORS,
  DELIVERABLE_TYPE_LABELS,
  DEAL_PRICE_REQUIRED_CODE,
  dealComponents,
  rateCardFrom,
  loadRateCard,
  proposeTerms,
  draftedDeliverableTypes,
  draftDeliverablesForDeal,
  missingPrices,
  findMissingPrices,
  dealPriceRequiredError,
  dealPriceRequiredBody,
};
