'use strict';

/**
 * Which ledger rows count toward Lala's balance (Task #2267).
 *
 * A row counts when it is executed, not soft-deleted, and not tied to a
 * deleted episode. docs/EVENT_EPISODE_FLOW.md §8(aa) M6: "Once an episode or
 * show is deleted, it no longer affects Lala's money. Ledger rows tied to a
 * deleted episode or show stay as history but are excluded from the balance;
 * the balance is recomputed as if that episode never happened."
 *
 * A row whose episode_id names no live episode (soft-deleted, or no longer
 * there at all) is excluded; a row with no episode (seed, manual adjustment,
 * a purchase outside any episode) counts. A deleted show's balance is read by
 * nothing, so its rows need no filter here.
 *
 * `alias` is the financial_transactions alias used in the query.
 */
function countedLedgerRows(alias = 'ft') {
  return `${alias}.status = 'executed' AND ${alias}.deleted_at IS NULL
    AND (${alias}.episode_id IS NULL OR EXISTS (
      SELECT 1 FROM episodes ep WHERE ep.id = ${alias}.episode_id AND ep.deleted_at IS NULL))`;
}

module.exports = { countedLedgerRows };
