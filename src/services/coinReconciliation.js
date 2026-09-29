'use strict';

/**
 * D1's one-time reconciliation, applied per approved show (§8(y) Q2, Q9;
 * docs/COINS_LEDGER_CACHE_DESIGN.md §8.3; Task #2250).
 *
 * For each approval, in its own transaction:
 *   1. lock the show row (the lock every ledger writer takes);
 *   2. void the approved ledger rows: status 'voided', with the reason in
 *      metadata; a row is never deleted (§8(aa) M6's "stay as history");
 *   3. syncCoinsFromLedger: seed the ledger if it has no seed row (Q2),
 *      sum it (M6's counted rows), write every 'lala' row;
 *   4. refuse, rolling everything back, unless the balance is exactly the
 *      approved one, so a ledger that changed since approval is not applied.
 * A dry run does all of it and rolls back, returning what would happen.
 */

const { syncCoinsFromLedger } = require('./coinLedgerSync');

class ReconciliationRefused extends Error {
  constructor(showId, message) {
    super(`Show ${showId}: ${message}`);
    this.name = 'ReconciliationRefused';
    this.showId = showId;
  }
}

class DryRunRollback extends Error {
  constructor(result) {
    super('dry run');
    this.result = result;
  }
}

function checkApproval(a) {
  if (!a || typeof a.show_id !== 'string' || !a.show_id) throw new TypeError('approval: show_id is required');
  if (!Number.isInteger(a.approved_balance) || a.approved_balance < 0) {
    throw new TypeError(`approval ${a.show_id}: approved_balance must be a whole number of at least 0`);
  }
  const ids = a.void_transaction_ids || [];
  if (!Array.isArray(ids)) throw new TypeError(`approval ${a.show_id}: void_transaction_ids must be a list`);
  if (ids.length > 0 && !a.void_reason) throw new TypeError(`approval ${a.show_id}: void_reason is required with voids`);
}

async function applyOne(sequelize, approval, { dryRun, actor }) {
  const { show_id: showId, approved_balance: approved } = approval;
  const voidIds = approval.void_transaction_ids || [];
  const work = async (transaction) => {
    const [show] = await sequelize.query(
      'SELECT id FROM shows WHERE id = :showId FOR NO KEY UPDATE',
      { replacements: { showId }, type: sequelize.QueryTypes.SELECT, transaction }
    );
    if (!show) throw new ReconciliationRefused(showId, 'show not found');

    const [before] = await sequelize.query(
      `SELECT coins FROM character_state WHERE show_id = :showId AND character_key = 'lala' ORDER BY id LIMIT 1`,
      { replacements: { showId }, type: sequelize.QueryTypes.SELECT, transaction }
    );

    let voided = [];
    if (voidIds.length > 0) {
      const rows = await sequelize.query(
        `SELECT id, show_id, status, deleted_at FROM financial_transactions WHERE id IN (:ids)`,
        { replacements: { ids: voidIds }, type: sequelize.QueryTypes.SELECT, transaction }
      );
      for (const id of voidIds) {
        const row = rows.find((r) => r.id === id);
        if (!row) throw new ReconciliationRefused(showId, `ledger row ${id} not found`);
        if (row.show_id !== showId) throw new ReconciliationRefused(showId, `ledger row ${id} belongs to another show`);
        if (row.status !== 'executed' || row.deleted_at) {
          throw new ReconciliationRefused(showId, `ledger row ${id} is not a live executed row (status ${row.status})`);
        }
      }
      const [updated] = await sequelize.query(
        `UPDATE financial_transactions
            SET status = 'voided', updated_at = NOW(),
                metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                  'voided', true, 'void_reason', CAST(:reason AS text), 'voided_at', NOW(),
                  'voided_by', CAST(:actor AS text), 'voided_under', 'D1 reconciliation (#2250)')
          WHERE id IN (:ids) AND show_id = :showId
          RETURNING id, category, amount`,
        { replacements: { ids: voidIds, showId, reason: approval.void_reason, actor: actor || null }, transaction }
      );
      voided = updated.map((r) => ({ id: r.id, category: r.category, amount: Number(r.amount) }));
    }

    const { balance, rows_updated: rowsUpdated } = await syncCoinsFromLedger(sequelize, showId, { transaction });
    if (balance !== approved) {
      throw new ReconciliationRefused(showId, `ledger sums to ${balance} after the voids, not the approved ${approved}`);
    }
    const result = {
      show_id: showId,
      approved_balance: approved,
      coins_before: before ? before.coins : null,
      coins_after: balance,
      lala_rows_updated: rowsUpdated,
      voided,
      applied: !dryRun,
    };
    if (dryRun) throw new DryRunRollback(result);
    return result;
  };

  try {
    return await sequelize.transaction(work);
  } catch (err) {
    if (err instanceof DryRunRollback) return err.result;
    throw err;
  }
}

/**
 * Apply `approvals` (default: none). Each show is its own transaction; a
 * refused show is reported and does not stop the others.
 *
 * @returns {Promise<{ dry_run: boolean, results: object[], refused: object[] }>}
 */
async function applyReconciliation(sequelize, approvals, { dryRun = true, actor = null } = {}) {
  if (!Array.isArray(approvals)) throw new TypeError('approvals must be a list');
  approvals.forEach(checkApproval);
  const results = [];
  const refused = [];
  for (const approval of approvals) {
    try {
      results.push(await applyOne(sequelize, approval, { dryRun, actor }));
    } catch (err) {
      if (!(err instanceof ReconciliationRefused)) throw err;
      console.error('[coinReconciliation] refused:', err.message);
      refused.push({ show_id: approval.show_id, reason: err.message });
    }
  }
  return { dry_run: dryRun, results, refused };
}

module.exports = { applyReconciliation, ReconciliationRefused };
