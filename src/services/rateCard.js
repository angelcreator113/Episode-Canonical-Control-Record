'use strict';

/**
 * The editable rate card (Evoni, 2026-10-19: "yes start the rate card after
 * phase 4"; dealPricingService ruling 5, "the editor is a later PR").
 *
 * The card is deal_rate_anchors (Prime Coins per component and career
 * tier) and deal_rate_premiums (percent per premium), versioned. Prices are
 * set by Lala's own career tier (Evoni's pricing ruling, 2026-10-01:
 * "Deal prices use Lala's own career tier (her rate card)"); the tier is
 * the band, 1 Emerging … 5 Elite, read from her reputation
 * (utils/careerTiers). There is no follower band in the pricing.
 *
 * An edit writes the next version: every row of the newest version copied,
 * the edited cells changed, and a deal_rate_card_versions row recording who,
 * when, the note and what changed. Nothing reprices on its own:
 *   - a deal whose terms are locked (its episode started) keeps its numbers;
 *     every terms write refuses while locked (utils/eventTermsLock);
 *   - a draft is priced from the new version the next time Propose terms
 *     runs (or its components change), and records what priced it
 *     (pricedFrom, under canon_consequences.automation.priced_from).
 *
 * Pure: bandOf, priceFor, cardTable, planChanges, pricedFrom.
 * Database: listVersions, saveRateCard.
 */

const { CAREER_TIERS } = require('../utils/careerTiers');
const { DELIVERABLE_FORMATS } = require('../utils/deliverableFormats');
const { RATE_COMPONENTS } = require('../models/DealRateAnchor');

const MAX_AMOUNT = 1000000;
const MAX_PERCENT = 500;
const NOTE_MAX = 500;
const TIERS = Object.freeze([1, 2, 3, 4, 5]);

// The event-level anchors (dealPricingService.EVENT_COMPONENTS) and each
// format's anchor (utils/deliverableFormats), in the order the card reads.
const COMPONENT_LABELS = Object.freeze({
  paid_appearance: 'Appearance fee',
  brand_partnership_base: 'Partnership base',
  performance_booking: 'Performance fee',
  ...Object.fromEntries(Object.values(DELIVERABLE_FORMATS).filter((f) => f.anchor).map((f) => [f.anchor, f.label])),
});

// How a format's anchor turns into a price, for the card's help line.
const COMPONENT_UNITS = Object.freeze(Object.fromEntries(Object.values(DELIVERABLE_FORMATS).filter((f) => f.anchor).map((f) => [
  f.anchor,
  f.pricing === 'per_slide_of_3' ? 'per 3 stories' : f.pricing === 'per_started_week' ? 'per started week' : 'per piece',
])));

const PREMIUM_LABELS = Object.freeze({
  rush: 'Rush', usage: 'Usage rights', exclusivity: 'Exclusivity', paid_ad: 'Paid ad / whitelisting',
});

/** The band for a tier: { tier, key, label }; an unknown tier is Emerging, as dealPricingService.tierOf. */
function bandOf(tier) {
  const n = Math.trunc(Number(tier));
  const t = n >= 1 && n <= 5 ? n : 1;
  return { tier: t, key: CAREER_TIERS[t].key, label: CAREER_TIERS[t].label };
}

/** The card's amount for a component at a tier, or null (not offered, or no card). */
function priceFor(card, component, tier) {
  const amount = card?.anchors?.[component]?.[bandOf(tier).tier];
  return amount == null ? null : Number(amount);
}

/**
 * The card as the editor shows it: { version, tiers: [{tier,key,label}],
 * anchors: [{ component, label, unit, amounts: {tier: amount|null} }],
 * premiums: [{ kind, label, keys: [{ key, percent }] }] }. Components the
 * card does not carry are left out; the order is COMPONENT_LABELS'.
 */
function cardTable(card) {
  if (!card) return null;
  const known = Object.keys(COMPONENT_LABELS);
  const extra = Object.keys(card.anchors || {}).filter((c) => !known.includes(c)).sort();
  const anchors = [...known, ...extra].filter((c) => card.anchors?.[c]).map((component) => ({
    component,
    label: COMPONENT_LABELS[component] || component,
    unit: COMPONENT_UNITS[component] || 'flat',
    amounts: Object.fromEntries(TIERS.map((t) => [t, priceFor(card, component, t)])),
  }));
  const premiums = Object.entries(card.premiums || {}).map(([kind, keys]) => ({
    kind,
    label: PREMIUM_LABELS[kind] || kind,
    keys: Object.entries(keys).map(([key, percent]) => ({ key, percent: percent == null ? null : Number(percent) })),
  }));
  return { version: card.version, tiers: TIERS.map(bandOf), anchors, premiums };
}

function wholeOrNull(value, max) {
  if (value === null || value === '') return { ok: true, value: null };
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max) return { ok: false };
  return { ok: true, value: n };
}

/**
 * What a save would change, checked against the newest card. Pure.
 *   changes: { anchors?: [{ component, career_tier, amount }],
 *              premiums?: [{ kind, key, percent }] }
 * amount / percent are whole numbers, or null for "not offered" / "no
 * percent yet". Only cells that exist on the card can change (no new
 * components or premiums), and a cell set to what it already is is not a
 * change. Returns { ok, errors, anchors: [{component, career_tier, from,
 * to}], premiums: [{kind, key, from, to}] }.
 */
function planChanges(card, changes) {
  const errors = [];
  const anchors = [];
  const premiums = [];
  if (!card) return { ok: false, errors: ['There is no rate card yet.'], anchors, premiums };
  const input = changes && typeof changes === 'object' ? changes : {};
  const seen = new Set();
  for (const c of Array.isArray(input.anchors) ? input.anchors : []) {
    const component = c?.component;
    const tier = Math.trunc(Number(c?.career_tier));
    const label = `${COMPONENT_LABELS[component] || component} at tier ${c?.career_tier}`;
    if (!RATE_COMPONENTS.includes(component) || !card.anchors?.[component]) { errors.push(`${component}: not on the rate card.`); continue; }
    if (!TIERS.includes(tier)) { errors.push(`${label}: the tier is 1 to 5.`); continue; }
    const id = `${component}:${tier}`;
    if (seen.has(id)) { errors.push(`${label}: changed twice.`); continue; }
    seen.add(id);
    const parsed = wholeOrNull(c.amount, MAX_AMOUNT);
    if (!parsed.ok) { errors.push(`${label}: a price is a whole number of Prime Coins from 0 to ${MAX_AMOUNT}, or empty for not offered.`); continue; }
    const from = priceFor(card, component, tier);
    if (from !== parsed.value) anchors.push({ component, career_tier: tier, from, to: parsed.value });
  }
  for (const p of Array.isArray(input.premiums) ? input.premiums : []) {
    const kind = p?.kind; const key = p?.key;
    const row = card.premiums?.[kind];
    if (!row || !Object.prototype.hasOwnProperty.call(row, key)) { errors.push(`${kind} ${key}: not a premium on the rate card.`); continue; }
    const id = `premium:${kind}:${key}`;
    if (seen.has(id)) { errors.push(`${PREMIUM_LABELS[kind] || kind} ${key}: changed twice.`); continue; }
    seen.add(id);
    const parsed = wholeOrNull(p.percent, MAX_PERCENT);
    if (!parsed.ok) { errors.push(`${PREMIUM_LABELS[kind] || kind} ${key}: a percent is a whole number from 0 to ${MAX_PERCENT}, or empty.`); continue; }
    const from = row[key] == null ? null : Number(row[key]);
    if (from !== parsed.value) premiums.push({ kind, key, from, to: parsed.value });
  }
  return { ok: errors.length === 0, errors, anchors, premiums };
}

/**
 * What priced a proposal, for the deal to keep (canon_consequences.
 * automation.priced_from): the card version, the band, and for each priced
 * component and deliverable the rate row (version, component, tier), its
 * amount then, and the fee written. Pure. null for a proposal that failed.
 */
function pricedFrom(proposal, { at = new Date() } = {}) {
  if (!proposal?.ok) return null;
  const band = bandOf(proposal.career_tier);
  const rate = (component, anchor, fee, premiums) => ({
    rate: { version: proposal.pricing_version, component, career_tier: band.tier },
    anchor, fee, premiums: (premiums || []).map((p) => `${p.kind}:${p.key}`),
  });
  const components = {};
  for (const c of Object.values(proposal.components || {})) {
    if (c.fee != null) components[c.field] = rate(c.anchor_component, c.anchor, c.fee, c.premiums);
  }
  const deliverables = {};
  for (const d of proposal.deliverables || []) {
    if (d.fee != null) deliverables[d.id] = rate(d.component, d.anchor, d.fee, d.premiums);
  }
  return {
    version: proposal.pricing_version,
    career_tier: band.tier,
    band: band.label,
    at: (at instanceof Date ? at : new Date(at)).toISOString(),
    components,
    deliverables,
  };
}

/** Every version, newest first: [{ version, note, changes, created_by_name, created_at }]. */
async function listVersions(sequelize, { transaction } = {}) {
  const [rows] = await sequelize.query(
    `SELECT version, note, changes, created_by_name, created_at FROM deal_rate_card_versions
      WHERE deleted_at IS NULL ORDER BY version DESC`, { transaction });
  return rows.map((r) => ({ ...r, changes: typeof r.changes === 'string' ? JSON.parse(r.changes) : r.changes }));
}

function httpError(status, message, extra = {}) {
  const err = new Error(message);
  err.status = status;
  Object.assign(err, extra);
  return err;
}

/**
 * Saves the edited cells as the next version. Throws a 400 (with errors)
 * for a change that cannot be made or that changes nothing, a 409 when
 * there is no card, and a 409 when the card moved on since basedOn (the
 * version the editor showed), so two editors never overwrite each other.
 * Returns { version, changes }.
 */
async function saveRateCard(sequelize, { changes, note, basedOn, user } = {}) {
  const { loadRateCard } = require('./dealPricingService');
  return sequelize.transaction(async (transaction) => {
    await sequelize.query(`SELECT pg_advisory_xact_lock(hashtext('deal_rate_card'))`, { transaction });
    const card = await loadRateCard(sequelize, { transaction });
    if (!card) throw httpError(409, 'There is no rate card yet.');
    if (basedOn != null && Number(basedOn) !== card.version) {
      throw httpError(409, `The rate card is at version ${card.version} now, not ${basedOn}. Reload it before saving.`, { version: card.version });
    }
    const plan = planChanges(card, changes);
    if (!plan.ok) throw httpError(400, plan.errors.join(' '), { errors: plan.errors });
    if (!plan.anchors.length && !plan.premiums.length) throw httpError(400, 'Nothing changed.', { errors: ['Nothing changed.'] });

    const version = card.version + 1;
    const anchorAmount = new Map(plan.anchors.map((a) => [`${a.component}:${a.career_tier}`, a.to]));
    for (const [component, tiers] of Object.entries(card.anchors)) {
      for (const [tier, amount] of Object.entries(tiers)) {
        const id = `${component}:${tier}`;
        await sequelize.query(
          `INSERT INTO deal_rate_anchors (version, component, career_tier, amount) VALUES (:version, :component, :tier, :amount)`,
          { replacements: { version, component, tier: Number(tier), amount: anchorAmount.has(id) ? anchorAmount.get(id) : amount }, transaction });
      }
    }
    const premiumPercent = new Map(plan.premiums.map((p) => [`${p.kind}:${p.key}`, p.to]));
    for (const [kind, keys] of Object.entries(card.premiums || {})) {
      for (const [key, percent] of Object.entries(keys)) {
        const id = `${kind}:${key}`;
        await sequelize.query(
          `INSERT INTO deal_rate_premiums (version, kind, key, percent) VALUES (:version, :kind, :key, :percent)`,
          { replacements: { version, kind, key, percent: premiumPercent.has(id) ? premiumPercent.get(id) : percent }, transaction });
      }
    }
    const recorded = { anchors: plan.anchors, premiums: plan.premiums };
    const cleanNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, NOTE_MAX) : null;
    await sequelize.query(
      `INSERT INTO deal_rate_card_versions (version, note, changes, created_by_id, created_by_name)
       VALUES (:version, :note, :changes, :byId, :byName)`,
      { replacements: {
        version, note: cleanNote, changes: JSON.stringify(recorded),
        byId: user?.id ? String(user.id) : null, byName: user?.name || user?.email || null,
      }, transaction });
    return { version, changes: recorded };
  });
}

module.exports = {
  COMPONENT_LABELS,
  PREMIUM_LABELS,
  TIERS,
  bandOf,
  priceFor,
  cardTable,
  planChanges,
  pricedFrom,
  listVersions,
  saveRateCard,
};
