'use strict';

/**
 * Deal payouts (deal build PR 5; docs/DEAL_DESIGN.md §4, §11.2, §10.3).
 *
 * Money only from accepted terms (Law 8). A deal event (deal_type set) is
 * paid:
 *   - at Complete accepted (QUESTION 1, "attendance"), for each component
 *     its deal carries (Evoni's Deal PR 3 ruling 4, and her answer 1 of
 *     2026-09-30: each under its own ledger name):
 *       appearance_fee        — the appearance
 *       partnership_base_fee  — a brand partnership's base
 *       performance_fee       — a performance booking
 *   - at Complete accepted, a deal_bonus only when the accepted deal
 *     contains one for the tier reached (Q12: "A SLAY does not
 *     automatically create Prime Coins"). bonus_terms is { slay?, pass?,
 *     safe? }: the amount for each evaluation tier that pays.
 *   - on each deliverable's approval, a content_fee of its fee, when the
 *     deal pays deliverables.
 * Each payout is one income row naming what caused it (Law 13):
 * source_type 'event' (source_id the event) or 'deliverable' (source_id
 * the deliverable), metadata.payer host or brand and the payer's name.
 * Each is paid once: every writer holds the show's ledger lock
 * (lockLedgerBalance) and books a row only when no executed row of that
 * category and source exists; the partial unique index (category,
 * source_id) over the five categories (migrations 20260929200004 and
 * 20260930160000) is the backstop. The check does not depend on the index,
 * so the code is safe even before the index migration runs.
 *
 * No cash deals (self-funded, invited/comped, gifted) are paid nothing.
 * A legacy event (deal_type null) books none of these; it keeps
 * event_payment and content_revenue in Finalize (D8).
 */

const { v4: uuidv4 } = require('uuid');

const PAYOUT_CATEGORIES = Object.freeze([
  'appearance_fee', 'partnership_base_fee', 'performance_fee', 'content_fee', 'deal_bonus',
]);

// The component key (dealPricingService.EVENT_COMPONENTS) → its ledger
// category, which is also its column on world_events.
const COMPONENT_CATEGORIES = Object.freeze({
  appearance: 'appearance_fee',
  partnership_base: 'partnership_base_fee',
  performance: 'performance_fee',
});

const COMPONENT_LABELS = Object.freeze({
  appearance: 'Appearance fee',
  partnership_base: 'Partnership base',
  performance: 'Performance fee',
});

// The evaluation tiers a bonus can name. fail never pays.
const BONUS_TIERS = Object.freeze(['slay', 'pass', 'safe']);

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[DealPayout] JSON parse failed:', err.message);
    return fallback;
  }
}

function wholePositive(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/**
 * Validates bonus_terms for the event PUT: null, or an object whose keys
 * are evaluation tiers (slay, pass, safe) and whose values are whole
 * numbers of coins, 1 or more. Returns { value } or { error }. An empty
 * object reads as null (no bonus).
 */
function normalizeBonusTerms(input) {
  const parsed = parseJson(input, input);
  if (parsed == null || parsed === '') return { value: null };
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: 'bonus_terms must be an object like { "slay": 200 }, or null' };
  }
  const value = {};
  for (const [tier, amount] of Object.entries(parsed)) {
    if (!BONUS_TIERS.includes(tier)) return { error: `bonus_terms tiers are ${BONUS_TIERS.join(', ')}` };
    if (amount == null || amount === '') continue;
    const n = Number(amount);
    if (!Number.isInteger(n) || n < 1) return { error: `bonus_terms.${tier} must be a whole number of coins, 1 or more` };
    value[tier] = n;
  }
  return { value: Object.keys(value).length ? value : null };
}

/** Who pays a component: the brand for a partnership base, else the host (a brand host if set). */
function payerFor(event, component) {
  const brand = event?.host_brand || null;
  if (component === 'partnership_base') return { payer: 'brand', payer_name: brand };
  return brand ? { payer: 'brand', payer_name: brand } : { payer: 'host', payer_name: event?.host || null };
}

/**
 * The rows Complete books for a deal event at `tier` (pure).
 * Returns [{ category, amount, description, metadata }].
 */
function completionPayouts(event, tier) {
  if (!event?.deal_type) return [];
  const { DEAL_PLANS, dealComponents } = require('./dealPricingService');
  const plan = DEAL_PLANS[event.deal_type];
  if (!plan || !plan.cash) return [];

  const rows = [];
  for (const component of dealComponents(event)) {
    const category = COMPONENT_CATEGORIES[component];
    const amount = wholePositive(event[category]);
    if (!category || amount <= 0) continue;
    rows.push({
      category,
      amount,
      description: `${COMPONENT_LABELS[component]} for "${event.name}"`,
      metadata: { component, deal_type: event.deal_type, ...payerFor(event, component) },
    });
  }

  const bonusTerms = normalizeBonusTerms(event.bonus_terms).value || {};
  const bonus = wholePositive(bonusTerms[tier]);
  if (bonus > 0) {
    rows.push({
      category: 'deal_bonus',
      amount: bonus,
      description: `Deal bonus (${String(tier).toUpperCase()}) for "${event.name}"`,
      metadata: { tier, deal_type: event.deal_type, ...payerFor(event, 'appearance') },
    });
  }
  return rows;
}

/** A deliverable's content fee (pure): its fee, when the deal pays deliverables. */
function contentFeeFor(event, deliverable) {
  if (!event?.deal_type) return 0;
  const { DEAL_PLANS } = require('./dealPricingService');
  const plan = DEAL_PLANS[event.deal_type];
  if (!plan || !plan.cash || !plan.deliverables) return 0;
  return wholePositive(deliverable?.fee);
}

// Books one payout row unless one is already executed for this category and
// source. The caller holds the show's ledger lock, so the check and the
// insert cannot race another payout writer.
async function insertPayout(sequelize, row, { transaction }) {
  const [existing] = await sequelize.query(
    `SELECT id FROM financial_transactions
      WHERE category = :category AND source_id = :sourceId
        AND status = 'executed' AND deleted_at IS NULL
      LIMIT 1`,
    { replacements: { category: row.category, sourceId: row.sourceId }, transaction }
  );
  if (existing?.[0]) return null;
  const [inserted] = await sequelize.query(
    `INSERT INTO financial_transactions
       (id, show_id, episode_id, event_id, type, category, amount, description,
        source_type, source_id, source_name, metadata, status, created_at, updated_at)
     VALUES (:id, :showId, :episodeId, :eventId, 'income', :category, :amount, :description,
        :sourceType, :sourceId, :sourceName, :metadata, 'executed', NOW(), NOW())
     RETURNING id, category, amount`,
    { replacements: {
      id: uuidv4(),
      showId: row.showId,
      episodeId: row.episodeId || null,
      eventId: row.eventId || null,
      category: row.category,
      amount: row.amount,
      description: row.description,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      sourceName: row.sourceName || null,
      metadata: JSON.stringify(row.metadata || {}),
    }, transaction }
  );
  return inserted?.[0] || null;
}

/**
 * Books Complete's deal payouts, inside Complete's transaction (which
 * already holds the episode and the show's ledger locks). Returns the rows
 * booked (a row already paid is skipped).
 */
async function bookCompletionPayouts(sequelize, { showId, episodeId, event, tier, transaction }) {
  const booked = [];
  for (const p of completionPayouts(event, tier)) {
    const row = await insertPayout(sequelize, {
      ...p, showId, episodeId, eventId: event.id,
      sourceType: 'event', sourceId: event.id, sourceName: event.name,
    }, { transaction });
    if (row) booked.push({ ...p, id: row.id });
  }
  return booked;
}

/**
 * Books a deliverable's content fee on approval, in its own transaction:
 * the show's ledger locked (D1), the row inserted once, the coin cache
 * synced. Returns the booked row, or null when nothing is owed or it was
 * already paid.
 */
async function bookContentFee(sequelize, { showId, event, deliverable, transaction }) {
  const amount = contentFeeFor(event, deliverable);
  if (amount <= 0) return null;
  const { lockLedgerBalance, syncCoinsFromLedger } = require('./coinLedgerSync');
  await lockLedgerBalance(sequelize, showId, { transaction });
  const owedTo = deliverable.owed_to === 'brand' ? 'brand' : 'host';
  const row = await insertPayout(sequelize, {
    showId,
    episodeId: deliverable.episode_id || event.used_in_episode_id || null,
    eventId: event.id,
    category: 'content_fee',
    amount,
    description: `Content fee: ${deliverable.description || 'deliverable'} for "${event.name}"`,
    sourceType: 'deliverable',
    sourceId: deliverable.id,
    sourceName: event.name,
    metadata: {
      owed_to: owedTo,
      payer: owedTo,
      payer_name: owedTo === 'brand' ? (event.host_brand || null) : (event.host || null),
      deliverable_type: deliverable.deliverable_type || null,
      deal_type: event.deal_type,
    },
  }, { transaction });
  await syncCoinsFromLedger(sequelize, showId, { transaction });
  return row ? { ...row, amount } : null;
}

module.exports = {
  PAYOUT_CATEGORIES,
  COMPONENT_CATEGORIES,
  BONUS_TIERS,
  normalizeBonusTerms,
  completionPayouts,
  contentFeeFor,
  bookCompletionPayouts,
  bookContentFee,
};
