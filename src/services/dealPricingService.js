'use strict';

/**
 * Deal pricing (deal build PR 3; docs/DEAL_DESIGN.md §3.2, §11.1; Task #2341).
 *
 * Evoni's answer to QUESTION 4 (docs/EVENT_EPISODE_FLOW.md §8(cc)): "Adopt
 * five Career Rate Anchors ... Rates are baselines, not fixed payouts.
 * Actual compensation is assembled from deal type, deliverables, rights,
 * restrictions, urgency and other canonical deal terms."
 *
 * proposeTerms is pure. It reads the rate card (deal_rate_anchors and
 * deal_rate_premiums, one version) and returns a proposal: an appearance
 * fee and a fee per deliverable, each from its component's anchor at the
 * event's career tier, with the premiums chosen for that line only ("Premiums
 * apply only to the component they affect"). Nothing is paid from it: the
 * route writes the numbers onto the deal as a draft Evoni edits before the
 * terms lock, and payouts (PR 5) read the event's stored numbers, never the
 * card.
 *
 * Ruled (§11.1):
 *   - no prestige multiplier;
 *   - a null anchor means the component is not offered at that tier;
 *   - self-funded, comped and gifted deals create no cash income;
 *   - paid_ad has no percent yet, so it cannot be applied ("set before use").
 *
 * PROPOSED here, for Evoni to confirm (each is one constant below):
 *   - DEAL_COMPONENTS: which anchor each deal type's appearance fee takes,
 *     and whether its deliverables are priced. brand_partnership_base is
 *     proposed as the partnership's base fee on appearance_fee.
 *   - DELIVERABLE_COMPONENTS: a deliverable_type containing "reel" takes the
 *     reel anchor; one containing "stor" takes stories_3 (the anchor for a
 *     set of three stories). Any other type has no anchor and is left for
 *     Evoni to price.
 *   - Premiums on one line add up (48h rush +10% and 30d usage +15% is
 *     +25%), then the line is rounded to whole Prime Coins.
 *   - No bonus is proposed: the anchors carry none, and a bonus exists only
 *     when the deal explicitly contains one (QUESTION 12).
 */

const PRICING_SOURCE = 'pricing';

// deal type → { appearance: anchor component or null, deliverables: priced? }
const DEAL_COMPONENTS = Object.freeze({
  self_funded: { appearance: null, deliverables: false },
  invited_comped: { appearance: null, deliverables: false },
  gifted: { appearance: null, deliverables: false },
  paid_appearance: { appearance: 'paid_appearance', deliverables: false },
  paid_deliverables: { appearance: null, deliverables: true },
  appearance_plus_deliverables: { appearance: 'paid_appearance', deliverables: true },
  performance_booking: { appearance: 'performance_booking', deliverables: false },
  brand_partnership: { appearance: 'brand_partnership_base', deliverables: true },
});

const NO_CASH_DEAL_TYPES = new Set(['self_funded', 'invited_comped', 'gifted']);

function deliverableComponent(deliverableType) {
  const t = String(deliverableType || '').toLowerCase();
  if (t.includes('reel')) return 'reel';
  if (t.includes('stor')) return 'stories_3';
  return null;
}

function tierOf(careerTier) {
  const n = Math.trunc(Number(careerTier));
  return n >= 1 && n <= 5 ? n : 1;
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
 * Apply the premiums chosen for one line. Returns { amount, applied, errors }.
 * choices: [{ kind, key }] — each must exist on the card with a percent.
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

/**
 * The proposal for one event.
 *   event:        { deal_type, career_tier }
 *   deliverables: [{ id, description, deliverable_type }]
 *   premiums:     { appearance: [{kind,key}], deliverables: { <id>: [{kind,key}] } }
 * Returns { ok, error?, pricing_version, career_tier, appearance, deliverables,
 * gaps, errors }. appearance and each deliverable carry
 * { component, anchor, fee, premiums, note }. A fee is null when there is no
 * anchor; gaps say why, for the Event Package to show.
 */
function proposeTerms({ event, deliverables = [], premiums = {}, card }) {
  const dealType = event?.deal_type || null;
  if (!dealType) return { ok: false, error: 'Choose a deal type before proposing terms.' };
  const plan = DEAL_COMPONENTS[dealType];
  if (!plan) return { ok: false, error: `Unknown deal type "${dealType}".` };
  if (!card) return { ok: false, error: 'There is no rate card yet, so no terms can be proposed.' };

  const tier = tierOf(event.career_tier);
  const gaps = [];
  const errors = [];
  const noCash = NO_CASH_DEAL_TYPES.has(dealType);

  let appearance = { component: null, anchor: null, fee: noCash ? 0 : null, premiums: [], note: null };
  if (noCash) {
    appearance.note = 'No cash income for this deal type (QUESTION 4).';
  } else if (plan.appearance) {
    const anchor = card.anchors?.[plan.appearance]?.[tier];
    if (anchor == null) {
      appearance = { component: plan.appearance, anchor: null, fee: null, premiums: [], note: `${plan.appearance} is not offered at tier ${tier}.` };
      gaps.push(appearance.note);
    } else {
      const priced = applyPremiums(anchor, premiums.appearance, card, 'Appearance fee');
      errors.push(...priced.errors);
      appearance = { component: plan.appearance, anchor, fee: priced.amount, premiums: priced.applied, note: null };
    }
  }

  const lines = (Array.isArray(deliverables) ? deliverables : []).map((d) => {
    if (noCash || !plan.deliverables) {
      return { id: d.id, component: null, anchor: null, fee: null, premiums: [], note: 'Not priced for this deal type.' };
    }
    const component = deliverableComponent(d.deliverable_type);
    if (!component) {
      const note = `"${d.description || d.deliverable_type || 'Deliverable'}" has no rate anchor; price it by hand.`;
      gaps.push(note);
      return { id: d.id, component: null, anchor: null, fee: null, premiums: [], note };
    }
    const anchor = card.anchors?.[component]?.[tier];
    if (anchor == null) {
      const note = `${component} is not offered at tier ${tier}.`;
      gaps.push(note);
      return { id: d.id, component, anchor: null, fee: null, premiums: [], note };
    }
    const priced = applyPremiums(anchor, premiums.deliverables?.[d.id], card, `"${d.description || component}"`);
    errors.push(...priced.errors);
    return { id: d.id, component, anchor, fee: priced.amount, premiums: priced.applied, note: null };
  });

  if (errors.length) return { ok: false, error: errors.join(' '), errors };
  return { ok: true, pricing_version: card.version, career_tier: tier, deal_type: dealType, appearance, deliverables: lines, gaps };
}

module.exports = {
  PRICING_SOURCE,
  DEAL_COMPONENTS,
  NO_CASH_DEAL_TYPES,
  deliverableComponent,
  rateCardFrom,
  loadRateCard,
  proposeTerms,
};
