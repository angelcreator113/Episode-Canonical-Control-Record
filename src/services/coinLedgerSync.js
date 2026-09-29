'use strict';

/**
 * character_state.coins as a cached copy of the ledger
 * (docs/EVENT_EPISODE_FLOW.md §8(x) D1 and §8(y); design in
 * docs/COINS_LEDGER_CACHE_DESIGN.md §6.1–§6.2; Task #2246).
 *
 * The ledger (financial_transactions) is Lala's balance. Every path that
 * writes the ledger calls syncCoinsFromLedger in the same transaction, after
 * its last ledger row, and nothing else writes character_state.coins.
 *
 * Both functions lock the show's row first, so ledger writers on one show run
 * one after another; the show row, not the 'lala' rows, is locked because a
 * show may have no 'lala' row yet and two first seeds must not both insert.
 * A caller that also locks an episode locks the episode first (D2's order).
 *
 * Kept out of financialTransactionService so tests that mock that module
 * still get these functions.
 */

const { InsufficientCoinsError } = require('./coinBalanceGuard');
const { wholeCoins } = require('../utils/wholeCoins');
const { countedLedgerRows } = require('../utils/ledgerBalanceFilter');

// getCurrentBalance's sum (financialTransactionService), rounded half away
// from zero (§8(y) Q7), over the rows that count (§8(aa) M6: not a deleted
// episode's). No fallbacks: an error throws and rolls back.
const LEDGER_BALANCE_SQL = `
  SELECT COUNT(*)::int AS tx_count,
         ROUND(COALESCE(
           SUM(CASE WHEN type IN ('income', 'reward') THEN amount
                    WHEN type IN ('expense', 'deduction') THEN -amount
                    ELSE 0 END), 0)) AS balance
    FROM financial_transactions ft
   WHERE ft.show_id = :showId AND ${countedLedgerRows('ft')}`;

function requireTransaction(fn, transaction) {
  if (!transaction) throw new TypeError(`${fn}: a transaction is required`);
}

/**
 * Lock the show, give its ledger a seed row if it has none, and return the
 * ledger balance. The seed commits or rolls back with the caller's rows.
 */
async function lockedLedgerBalance(sequelize, showId, transaction) {
  const [show] = await sequelize.query(
    'SELECT id FROM shows WHERE id = :showId FOR NO KEY UPDATE',
    { replacements: { showId }, type: sequelize.QueryTypes.SELECT, transaction }
  );
  if (!show) throw new Error(`coinLedgerSync: show ${showId} not found`);

  // Required here, not at the top: financialTransactionService is the
  // module tests mock, and it does not require this one.
  const { seedStartingBalance, getStartingBalance } = require('./financialTransactionService');
  await seedStartingBalance(sequelize, showId, { transaction });

  const [row] = await sequelize.query(LEDGER_BALANCE_SQL, {
    replacements: { showId }, type: sequelize.QueryTypes.SELECT, transaction,
  });
  // An empty ledger (a starting balance of 0, so no seed) is the starting
  // balance, as getCurrentBalance reports it.
  if ((row?.tx_count || 0) === 0) return wholeCoins(await getStartingBalance(sequelize, showId));
  return Number(row.balance);
}

/**
 * Write the ledger balance to every 'lala' character_state row of the show
 * (§8(y) Q3, Q4) and return it.
 *
 * @returns {Promise<{ balance: number, rows_updated: number }>}
 */
async function syncCoinsFromLedger(sequelize, showId, { transaction } = {}) {
  requireTransaction('syncCoinsFromLedger', transaction);
  const balance = await lockedLedgerBalance(sequelize, showId, transaction);
  const [, meta] = await sequelize.query(
    `UPDATE character_state SET coins = :balance, updated_at = NOW()
      WHERE show_id = :showId AND character_key = 'lala'`,
    { replacements: { showId, balance }, transaction }
  );
  const rowsUpdated = typeof meta === 'number' ? meta : (meta?.rowCount ?? 0);
  return { balance, rows_updated: rowsUpdated };
}

/**
 * Check that the ledger can pay `cost` before the caller books it. Throws
 * InsufficientCoinsError, writing nothing, when it would go below zero. The
 * caller then writes its ledger row(s) and calls syncCoinsFromLedger.
 *
 * @returns {Promise<{ balance: number, cost: number }>} the balance before
 *   the spend and the cost as booked (whole coins).
 */
async function spendFromLedger(sequelize, { showId, cost, transaction, action = 'spend' } = {}) {
  requireTransaction('spendFromLedger', transaction);
  const c = wholeCoins(cost);
  if (c < 0) throw new TypeError(`spendFromLedger: cost must not be negative, got ${cost}`);
  const balance = await lockedLedgerBalance(sequelize, showId, transaction);
  if (balance - c < 0) throw new InsufficientCoinsError({ needed: c, have: balance, action });
  return { balance, cost: c };
}

module.exports = {
  syncCoinsFromLedger,
  spendFromLedger,
  LEDGER_BALANCE_SQL,
};
