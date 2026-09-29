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
 * Evoni's decisions of 2026-09-29, on her production run of
 * scripts/sql/d1-reconciliation-readonly.sql (recorded in
 * docs/audit/F-Stats-1_D1_ReconciliationRead_2026-09-29.md):
 *   - live show 9bd0655f…: approve 1900; void its four wardrobe_purchase rows
 *     (285 + 385 + 385 + 385 = 1,440, test data), leaving the 1900 seed alone;
 *   - deleted shows bd52ee95… and b1cff675…: no change (no entry);
 *   - orphan character_state row ae018fad… (no show): no change here (#2266).
 */
const D1_RECONCILIATION_APPROVALS = Object.freeze([
  Object.freeze({
    show_id: '9bd0655f-0426-4da4-95b8-44cdfd608b2b',
    approved_balance: 1900,
    void_transaction_ids: Object.freeze([
      '1e9da9a3-e7fc-48a7-850e-295c1ae7945d', // wardrobe_purchase 285, 2026-09-26 00:39:28
      'd7b34f33-b51d-4d3f-8659-3f2dd2516575', // wardrobe_purchase 385, 2026-09-26 00:39:29
      'b008d849-f3f1-4306-a32f-31ae18d844ac', // wardrobe_purchase 385, 2026-09-26 00:39:29
      '3408a459-f230-48e5-8c80-11fd1c173588', // wardrobe_purchase 385, 2026-09-26 02:19:47
    ]),
    void_reason: 'Test data, not story purchases (Evoni, 2026-09-29)',
    approved_on: '2026-09-29',
  }),
]);

module.exports = { D1_RECONCILIATION_APPROVALS };
