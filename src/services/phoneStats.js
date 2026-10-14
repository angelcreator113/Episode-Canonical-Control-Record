'use strict';

/**
 * The stats panel on Lala's Phone home screen (spec §2; Task #3164; the
 * phase 1 read, docs/reads/2026-10-14-phone-hub-read.md §7 and §9): her
 * coins, reputation and influence as of a beat, and her followers once The
 * Pulse has her numbers. Read only; each stat from its one owner.
 *
 * "As of" a story order `at` (storyClock: episode × 10 + phase): an episode's
 * changes land when it completes, at its "after" moment (n × 10 + 7), so an
 * episode counts when n × 10 + 7 ≤ at. A beat during episode N
 * (beatOrder, N × 10 + 5) sees every episode before N and none of N. With no
 * `at`, everything counts: the present.
 *
 *   coins       the ledger balance (getCurrentBalance) less the counted rows
 *               of the episodes that don't count yet, as financial-summary's
 *               rolling balance does. Rows on no episode (the seed, a purchase
 *               outside an episode) count from the start, before Episode 1
 *               (Evoni, 2026-10-14). Never getBalanceBeforeEpisode, which
 *               keeps later episodes' rows (read §7).
 *   reputation, influence
 *               the snapshot (state_after_json) of the latest history row of
 *               an episode that counts. With none, the value before the
 *               first episode that doesn't count (its snapshot less its
 *               change). With no history either, character_state now.
 *   followers   her accepted count at `at` in the follower ledger
 *               (pulseFollowers.countAt), with its tier; null before her
 *               numbers exist, so the panel leaves the row out. The profile's
 *               free-text estimate is never shown here.
 */

const { countedLedgerRows } = require('../utils/ledgerBalanceFilter');
const { wholeCoins } = require('../utils/wholeCoins');

const SCALE = 10;   // character_state's 0–10 stats
const STATS = ['reputation', 'influence'];

const counts = (alias) => `(COALESCE(${alias}.episode_number, 0) * 10 + 7 <= :at)`;
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const clamp = (v) => Math.max(0, Math.min(SCALE, v));

async function coinsAt(sequelize, showId, at) {
  const { getCurrentBalance } = require('./financialTransactionService');
  const now = await getCurrentBalance(sequelize, showId);
  if (!Number.isInteger(at)) return wholeCoins(now);
  const [row] = await sequelize.query(
    `SELECT COALESCE(
        SUM(CASE WHEN ft.type IN ('income', 'reward') THEN ft.amount ELSE 0 END) -
        SUM(CASE WHEN ft.type IN ('expense', 'deduction') THEN ft.amount ELSE 0 END), 0) AS net
       FROM financial_transactions ft
       JOIN episodes e ON e.id = ft.episode_id AND e.deleted_at IS NULL
      WHERE ft.show_id = :showId AND ${countedLedgerRows('ft')} AND NOT ${counts('e')}`,
    { replacements: { showId, at }, type: sequelize.QueryTypes.SELECT });
  return wholeCoins(now - (parseFloat(row?.net) || 0));
}

async function standingAt(sequelize, showId, at) {
  const q = (sql) => sequelize.query(sql, { replacements: { showId, at }, type: sequelize.QueryTypes.SELECT });
  const [state] = await q(
    `SELECT reputation, influence FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1`);
  const out = { reputation: state ? num(state.reputation) : null, influence: state ? num(state.influence) : null };
  if (!Number.isInteger(at)) return out;
  const rows = (where, order) => q(
    `SELECT h.deltas_json, h.state_after_json
       FROM character_state_history h JOIN episodes e ON e.id = h.episode_id AND e.deleted_at IS NULL
      WHERE h.show_id = :showId AND h.character_key = 'lala' AND h.state_after_json IS NOT NULL AND ${where}
      ORDER BY COALESCE(e.episode_number, 0) ${order}, h.created_at ${order}`);
  const before = await rows(counts('e'), 'DESC');
  const after = await rows(`NOT ${counts('e')}`, 'ASC');
  for (const stat of STATS) {
    const last = before.find((r) => num(r.state_after_json?.[stat]) !== null);
    if (last) { out[stat] = num(last.state_after_json[stat]); continue; }
    const first = after.find((r) => num(r.state_after_json?.[stat]) !== null);
    if (first) out[stat] = clamp(num(first.state_after_json[stat]) - (num(first.deltas_json?.[stat]) || 0));
  }
  return out;
}

async function followersAt(db, showId, at, lalaProfileId) {
  try {
    const profileId = lalaProfileId !== undefined ? lalaProfileId : await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
    if (!profileId) return null;
    const count = await require('./pulseFollowers').countAt(db, showId, profileId, Number.isInteger(at) ? at : null);
    if (count === null) return null;
    const tier = require('./pulseAudience').tierFor(count);
    return { count, tier: tier ? { key: tier.key, label: tier.label } : null };
  } catch (err) {
    // The row is left out rather than the panel failing (Task #3164).
    console.error('[PhoneStats] follower count read failed:', err.message);
    return null;
  }
}

/** { at, coins, reputation, influence, scale, followers } as of `at` (a story order), or now. */
async function statsAt(db, showId, at, { lalaProfileId } = {}) {
  const { sequelize } = db;
  const when = Number.isInteger(at) ? at : null;
  const [coins, standing, followers] = await Promise.all([
    coinsAt(sequelize, showId, when),
    standingAt(sequelize, showId, when),
    followersAt(db, showId, when, lalaProfileId),
  ]);
  return { at: when, coins, ...standing, scale: SCALE, followers };
}

module.exports = { statsAt, SCALE };
