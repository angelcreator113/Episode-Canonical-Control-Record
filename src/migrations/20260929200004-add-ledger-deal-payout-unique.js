'use strict';

/**
 * One executed ledger row per deal payout (deal build PR 1, M-5;
 * docs/DEAL_DESIGN.md §8; Task #2319). A partial unique index on
 * financial_transactions (category, source_id) for the three deal payout
 * categories, so a retried Complete or approval cannot pay twice:
 *
 *   appearance_fee — source_id is the event
 *   content_fee    — source_id is the event_deliverables row
 *   deal_bonus     — source_id is the event
 *
 * No code writes these categories yet (the payout PR does), so no existing
 * row can conflict. IF NOT EXISTS; down drops only this index.
 */
const INDEX = 'financial_transactions_deal_payout_once';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${INDEX}
         ON financial_transactions (category, source_id)
       WHERE category IN ('appearance_fee', 'content_fee', 'deal_bonus')
         AND status = 'executed'
         AND deleted_at IS NULL`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${INDEX}`);
  },
};
