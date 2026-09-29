'use strict';

/**
 * D1's one-time reconciliation: Evoni's per-show approvals (§8(y) Q9, "The
 * one-time reconciliation is proposed per show and applied only after Evoni
 * approves each show's balance"; Task #2250).
 *
 * The apply action (src/services/coinReconciliation.js) applies these
 * entries and nothing else. Each entry:
 *   show_id                 the full show id
 *   approved_balance        the balance Evoni approved, in whole coins; the
 *                           action refuses the show unless the ledger, after
 *                           the voids, sums to exactly this
 *   void_transaction_ids    ledger rows to mark voided (never deleted)
 *   void_reason             recorded on each voided row
 *   approved_on             the date of Evoni's approval
 *
 * Evoni's decisions of 2026-09-29, pending the full ids from her pasted
 * query output (only 8-character prefixes are in hand):
 *   - live show 9bd0655f…: approve 1900; void its four wardrobe_purchase rows
 *     (1,440 total, test data), leaving the 1900 seed alone;
 *   - deleted shows bd52ee95… and b1cff675…: no change (no entry);
 *   - orphan character_state row ae018fad… (no show): no change here (#2266).
 */
const D1_RECONCILIATION_APPROVALS = Object.freeze([]);

module.exports = { D1_RECONCILIATION_APPROVALS };
