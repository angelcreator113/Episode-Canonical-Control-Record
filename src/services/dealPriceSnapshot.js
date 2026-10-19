'use strict';

/**
 * The agreed deal's frozen prices (Evoni, 2026-10-19, with the rate card
 * editor): "When a deal is accepted or agreed, store a frozen price snapshot
 * on that deal: the deliverable type, band, unit price, quantity, total and
 * rate row id, plus when it was taken. Every historical calculation then
 * reads the snapshot, never the live card. Editing the card afterward must
 * not change any accepted deal's snapshot."
 *
 * A deal is agreed when its terms lock: Start Episode (episodeGenerator.
 * generateEpisodeFromEvent, inside its transaction), a companion event linked
 * by generate-episode-from-many, and Save and relock after a reopen
 * (termsReopenService.relockTerms). Each takes the snapshot then; one row
 * per priced line in deal_price_snapshots:
 *   line_kind      'component' (appearance, partnership base, performance)
 *                  or 'deliverable'
 *   line_key       the event column, or the deliverable's id
 *   deliverable_type, label, unit ('flat', 'per piece', 'per 3 stories',
 *                  'per started week')
 *   career_tier, band   the band it was priced at
 *   unit_price     the card's amount for that line at that band, in the
 *                  version that priced it (null for a hand-priced line)
 *   quantity       pieces, slides or days (1 for a component)
 *   total          the agreed number on the deal, premiums and Evoni's
 *                  edits included; what the deal pays
 *   rate_anchor_id, rate_version   the deal_rate_anchors row, or null
 *   premiums       ['rush:24h', …]
 *   taken_at, reason ('start_episode' | 'linked_episode' | 'relocked')
 *
 * The snapshot copies the numbers, so nothing done to the card later can
 * reach it; a card edit only ever writes a new version anyway
 * (services/rateCard). A snapshot is replaced only when the deal's own
 * agreed lines changed (terms reopened and relocked, or an episode deleted
 * and the deal started again with new numbers): the old rows are
 * soft-deleted, never edited, so the history stays.
 *
 * Who reads what: payouts (dealPayoutService) and the money lines read the
 * deal's locked numbers, which the terms lock keeps equal to the snapshot's
 * totals; no historical calculation reads deal_rate_anchors (only Propose
 * terms does, on a deal not yet agreed). readPriceSnapshot is the record.
 */

const { planFor, EVENT_COMPONENTS, lalaPricingTier } = require('./dealPricingService');
const { formatOf, quantityOf, deliverableTypeLabel } = require('../utils/deliverableFormats');
const { bandOf } = require('./rateCard');

const UNIT = { per_unit: 'per piece', per_slide_of_3: 'per 3 stories', per_started_week: 'per started week' };

function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[DealPriceSnapshot] JSON parse failed:', err.message);
    return fallback;
  }
}

/** One card version's anchors with their row ids: { <component>: { <tier>: { id, amount } } }. */
async function loadAnchorRows(sequelize, version, { transaction } = {}) {
  if (version == null) return {};
  const [rows] = await sequelize.query(
    `SELECT id, component, career_tier, amount FROM deal_rate_anchors WHERE version = :version AND deleted_at IS NULL`,
    { replacements: { version }, transaction });
  const out = {};
  for (const r of rows) (out[r.component] ||= {})[r.career_tier] = { id: r.id, amount: r.amount == null ? null : Number(r.amount) };
  return out;
}

/**
 * The snapshot's lines for a deal. Pure.
 *   event:        world_events row (deal fields)
 *   deliverables: the deal's live deliverables
 *   anchors:      loadAnchorRows for the version that priced it
 *   pricedFrom:   automation.priced_from (services/rateCard.pricedFrom), or null
 *   tier:         the band to use when pricedFrom has none
 *   version:      the card version when pricedFrom has none (event.pricing_version)
 * Returns [{ line_kind, line_key, deliverable_type, label, unit, career_tier,
 * band, unit_price, quantity, total, rate_anchor_id, rate_version, premiums }]
 * for every line that has an agreed number; [] when the deal pays nothing.
 */
function snapshotLines({ event, deliverables = [], anchors = {}, pricedFrom = null, tier, version }) {
  const plan = planFor(event);
  if (!plan || !plan.cash) return [];
  const band = bandOf(pricedFrom?.career_tier ?? tier);
  const rateVersion = pricedFrom?.version ?? version ?? null;
  const rateOf = (component) => (component ? anchors?.[component]?.[band.tier] || null : null);
  const lines = [];

  for (const key of plan.components || []) {
    const spec = EVENT_COMPONENTS[key];
    const total = event[spec.field];
    if (total == null) continue;
    const row = rateOf(spec.anchor);
    const priced = pricedFrom?.components?.[spec.field];
    lines.push({
      line_kind: 'component', line_key: spec.field, deliverable_type: null, label: spec.label, unit: 'flat',
      career_tier: band.tier, band: band.label,
      unit_price: row?.amount ?? null, quantity: 1, total: Number(total),
      rate_anchor_id: row?.id || null, rate_version: row ? rateVersion : null,
      premiums: priced?.premiums || [],
    });
  }

  if (plan.deliverables) {
    for (const d of Array.isArray(deliverables) ? deliverables : []) {
      if (d?.fee == null) continue;
      const format = formatOf(d.deliverable_type);
      const row = rateOf(format?.anchor);
      const priced = pricedFrom?.deliverables?.[d.id];
      lines.push({
        line_kind: 'deliverable', line_key: String(d.id), deliverable_type: d.deliverable_type || null,
        label: d.description || deliverableTypeLabel(d) || 'Deliverable',
        unit: format?.anchor ? UNIT[format.pricing] || 'per piece' : 'flat',
        career_tier: band.tier, band: band.label,
        unit_price: row?.amount ?? null, quantity: quantityOf(d), total: Number(d.fee),
        rate_anchor_id: row?.id || null, rate_version: row ? rateVersion : null,
        premiums: priced?.premiums || [],
      });
    }
  }
  return lines;
}

/** Two snapshots agree when every line has the same key, type, quantity and total. Pure. */
function sameLines(a, b) {
  const sig = (l) => `${l.line_kind}|${l.line_key}|${l.deliverable_type}|${Number(l.quantity)}|${Number(l.total)}`;
  const x = (a || []).map(sig).sort();
  const y = (b || []).map(sig).sort();
  return x.length === y.length && x.every((s, i) => s === y[i]);
}

/** The deal's live snapshot, oldest line first; [] when none was taken. */
async function readPriceSnapshot(sequelize, eventId, { transaction } = {}) {
  const [rows] = await sequelize.query(
    `SELECT line_kind, line_key, deliverable_type, label, unit, career_tier, band, unit_price, quantity, total,
            rate_anchor_id, rate_version, premiums, taken_at, reason
       FROM deal_price_snapshots WHERE event_id = :eventId AND deleted_at IS NULL
      ORDER BY line_kind, created_at, line_key`,
    { replacements: { eventId }, transaction });
  return rows.map((r) => ({ ...r, premiums: parseJson(r.premiums, []) }));
}

/**
 * Takes the deal's snapshot as it is agreed. Keeps a snapshot that already
 * matches the deal's lines (so a second lock, or a card edit in between,
 * changes nothing); replaces one whose lines differ by soft-deleting it.
 * Returns { taken: boolean, kept: boolean, lines }.
 */
async function takePriceSnapshot(sequelize, eventId, { transaction, reason = 'start_episode' } = {}) {
  const [eventRows] = await sequelize.query(
    `SELECT id, show_id, deal_type, deal_components, career_tier, appearance_required, appearance_fee,
            partnership_base_fee, performance_fee, pricing_version, canon_consequences
       FROM world_events WHERE id = :eventId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { eventId }, transaction });
  const event = eventRows?.[0];
  if (!event) return { taken: false, kept: false, lines: [] };

  const [deliverables] = await sequelize.query(
    `SELECT id, description, deliverable_type, quantity, fee FROM event_deliverables
      WHERE event_id = :eventId AND deleted_at IS NULL ORDER BY created_at ASC`,
    { replacements: { eventId }, transaction });
  const pricedFrom = parseJson(event.canon_consequences, {})?.automation?.priced_from || null;
  const version = pricedFrom?.version ?? event.pricing_version ?? null;
  const tier = pricedFrom?.career_tier ?? (await lalaPricingTier(sequelize, event, { transaction })).tier;
  const anchors = await loadAnchorRows(sequelize, version, { transaction });
  const lines = snapshotLines({ event, deliverables, anchors, pricedFrom, tier, version });

  const existing = await readPriceSnapshot(sequelize, eventId, { transaction });
  if (existing.length && sameLines(existing, lines)) return { taken: false, kept: true, lines: existing };
  if (existing.length) {
    await sequelize.query(
      `UPDATE deal_price_snapshots SET deleted_at = NOW(), updated_at = NOW() WHERE event_id = :eventId AND deleted_at IS NULL`,
      { replacements: { eventId }, transaction });
  }
  if (!lines.length) return { taken: false, kept: false, lines: [] };
  for (const l of lines) {
    await sequelize.query(
      `INSERT INTO deal_price_snapshots
         (event_id, line_kind, line_key, deliverable_type, label, unit, career_tier, band, unit_price, quantity, total,
          rate_anchor_id, rate_version, premiums, taken_at, reason)
       VALUES (:eventId, :line_kind, :line_key, :deliverable_type, :label, :unit, :career_tier, :band, :unit_price, :quantity, :total,
          :rate_anchor_id, :rate_version, :premiums, NOW(), :reason)`,
      { replacements: { eventId, ...l, premiums: JSON.stringify(l.premiums || []), reason }, transaction });
  }
  return { taken: true, kept: false, lines: await readPriceSnapshot(sequelize, eventId, { transaction }) };
}

module.exports = {
  snapshotLines,
  sameLines,
  loadAnchorRows,
  readPriceSnapshot,
  takePriceSnapshot,
};
