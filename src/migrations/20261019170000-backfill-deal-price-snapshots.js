'use strict';

/**
 * Backfill the frozen price snapshot for deals agreed before the rate card
 * editor (Evoni, 2026-10-19: "backfill the snapshots").
 *
 * 20261019150000-rate-card-editor added deal_price_snapshots; a snapshot is
 * taken when a deal's terms lock (services/dealPriceSnapshot). Deals whose
 * terms locked before that had none. This takes one for each of them.
 *
 * Agreed, as the terms lock defines it (utils/eventTermsLock
 * findTermsWriteLock): a live episode whose live brief names the event, else
 * world_events.used_in_episode_id pointing at a live episode, and the terms
 * not reopened (no terms_reopen marker). Skipped, and counted in the log:
 * deals not agreed (drafts), deals reopened right now (their relock takes
 * the snapshot), deals that already have a live snapshot, and deals that pay
 * nothing (no cash line).
 *
 * The rows come from the deal's own agreed numbers (its fee columns and its
 * deliverables' fees), never from the live card. The rate row, version and
 * unit price are recorded only when automation.priced_from names the version
 * and band that priced the deal; otherwise they are null, because the band
 * Lala was at when the deal was agreed is not known. The band itself is then
 * the event's stated career tier, as recorded on the deal.
 *
 * Line building reuses dealPriceSnapshot.snapshotLines, the pure function
 * the terms lock itself uses. A copy here would drift from it, and a
 * backfilled snapshot whose lines differ from what a later relock builds
 * would be replaced on that relock (sameLines) for no real change.
 *
 * reason 'backfill'; taken_at the time the terms locked when it is known
 * (the latest relock in terms_history, else the locking brief's created_at),
 * otherwise NOW(). Running it again adds nothing. down removes only the
 * rows this wrote (reason 'backfill').
 */

const REASON = 'backfill';

function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[backfill-deal-price-snapshots] JSON parse failed:', err.message);
    return fallback;
  }
}

/** When the terms locked: the latest relock, else the locking brief, else null. */
function lockedAt(cc, briefCreatedAt) {
  const relocks = (Array.isArray(cc?.terms_history) ? cc.terms_history : [])
    .filter((h) => h?.action === 'terms_relocked' && h.at)
    .map((h) => new Date(h.at))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (relocks.length) return new Date(Math.max(...relocks.map((d) => d.getTime())));
  return briefCreatedAt ? new Date(briefCreatedAt) : null;
}

module.exports = {
  lockedAt,

  async up(queryInterface) {
    const { snapshotLines, loadAnchorRows } = require('../services/dealPriceSnapshot');
    const { sequelize } = queryInterface;
    const counts = { backfilled: 0, rows: 0, not_agreed: 0, reopened: 0, has_snapshot: 0, pays_nothing: 0 };

    await sequelize.transaction(async (transaction) => {
      const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, transaction, type: sequelize.QueryTypes.SELECT });

      // Every live deal, with the brief that locks it (if any) and whether
      // its used_in_episode_id points at a live episode.
      const events = await q(
        `SELECT w.id, w.show_id, w.deal_type, w.deal_components, w.career_tier, w.appearance_required,
                w.appearance_fee, w.partnership_base_fee, w.performance_fee, w.pricing_version, w.canon_consequences,
                (SELECT b.created_at FROM episode_briefs b JOIN episodes e ON e.id = b.episode_id
                  WHERE b.event_id = w.id AND b.deleted_at IS NULL AND e.deleted_at IS NULL
                  ORDER BY b.created_at DESC LIMIT 1) AS brief_created_at,
                EXISTS (SELECT 1 FROM episodes e WHERE e.id = w.used_in_episode_id AND e.deleted_at IS NULL) AS linked_live,
                EXISTS (SELECT 1 FROM deal_price_snapshots s WHERE s.event_id = w.id AND s.deleted_at IS NULL) AS has_snapshot
           FROM world_events w
          WHERE w.deleted_at IS NULL AND (w.deal_type IS NOT NULL OR w.deal_components IS NOT NULL)
          ORDER BY w.created_at, w.id`);

      for (const event of events) {
        if (!event.brief_created_at && !event.linked_live) { counts.not_agreed += 1; continue; }
        const cc = parseJson(event.canon_consequences, {}) || {};
        if (cc.terms_reopen && typeof cc.terms_reopen === 'object') { counts.reopened += 1; continue; }
        if (event.has_snapshot) { counts.has_snapshot += 1; continue; }

        const deliverables = await q(
          `SELECT id, description, deliverable_type, quantity, fee FROM event_deliverables
            WHERE event_id = :eventId AND deleted_at IS NULL ORDER BY created_at ASC`,
          { eventId: event.id });
        const pricedFrom = cc.automation?.priced_from || null;
        const known = pricedFrom?.version != null && pricedFrom?.career_tier != null;
        const anchors = known ? await loadAnchorRows(sequelize, pricedFrom.version, { transaction }) : {};
        const lines = snapshotLines({
          event, deliverables, anchors,
          pricedFrom: known ? pricedFrom : null,
          tier: known ? pricedFrom.career_tier : event.career_tier,
          version: known ? pricedFrom.version : null,
        });
        if (!lines.length) { counts.pays_nothing += 1; continue; }

        const takenAt = lockedAt(cc, event.brief_created_at);
        for (const l of lines) {
          await sequelize.query(
            `INSERT INTO deal_price_snapshots
               (event_id, line_kind, line_key, deliverable_type, label, unit, career_tier, band, unit_price, quantity, total,
                rate_anchor_id, rate_version, premiums, taken_at, reason)
             VALUES (:eventId, :line_kind, :line_key, :deliverable_type, :label, :unit, :career_tier, :band, :unit_price, :quantity, :total,
                :rate_anchor_id, :rate_version, :premiums, COALESCE(:takenAt, NOW()), :reason)`,
            { replacements: { eventId: event.id, ...l, premiums: JSON.stringify(l.premiums || []), takenAt, reason: REASON }, transaction });
        }
        counts.backfilled += 1;
        counts.rows += lines.length;
      }
    });

    console.log(`[backfill-deal-price-snapshots] backfilled ${counts.backfilled} deal(s), ${counts.rows} line(s); skipped: `
      + `${counts.not_agreed} not agreed, ${counts.reopened} reopened, ${counts.has_snapshot} already had a snapshot, `
      + `${counts.pays_nothing} pay nothing`);
    return counts;
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DELETE FROM deal_price_snapshots WHERE reason = :reason`, { replacements: { reason: REASON } });
  },
};
