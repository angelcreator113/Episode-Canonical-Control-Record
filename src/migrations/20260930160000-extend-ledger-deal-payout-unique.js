'use strict';

/**
 * One executed ledger row per deal payout, now for five categories (deal
 * build PR 5; docs/DEAL_DESIGN.md §4 and §10.3).
 *
 * Evoni, 2026-09-30, answer 1: "Partnership base and performance fee are
 * paid at Complete, each under its own ledger name; one guarded migration
 * extends the payout unique index. Ship it in the same deploy as #2303."
 *
 * PR 1's partial unique index, financial_transactions_deal_payout_once
 * (migration 20260929200004), covers appearance_fee, content_fee and
 * deal_bonus. This rebuilds it, under the same name, to also cover the two
 * component names PR 3 added:
 *
 *   appearance_fee       — source_id is the event
 *   partnership_base_fee — source_id is the event
 *   performance_fee      — source_id is the event
 *   content_fee          — source_id is the event_deliverables row
 *   deal_bonus           — source_id is the event
 *
 * Guarded: it reads the index's definition from pg_indexes and rebuilds only
 * when the definition lacks the new categories, so a re-run is a no-op, and
 * PR 1's own "CREATE ... IF NOT EXISTS" re-run finds the name taken. No code
 * wrote any of these categories before PR 5, so no existing row conflicts.
 * down restores PR 1's three-category definition.
 */
const INDEX = 'financial_transactions_deal_payout_once';

const FIVE = "'appearance_fee', 'partnership_base_fee', 'performance_fee', 'content_fee', 'deal_bonus'";
const THREE = "'appearance_fee', 'content_fee', 'deal_bonus'";

async function indexDef(queryInterface) {
  const [rows] = await queryInterface.sequelize.query(
    'SELECT indexdef FROM pg_indexes WHERE indexname = :name',
    { replacements: { name: INDEX } }
  );
  return rows?.[0]?.indexdef || null;
}

async function rebuild(queryInterface, categories) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${INDEX}`, { transaction });
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX ${INDEX}
         ON financial_transactions (category, source_id)
       WHERE category IN (${categories})
         AND status = 'executed'
         AND deleted_at IS NULL`,
      { transaction }
    );
  });
}

module.exports = {
  async up(queryInterface) {
    const def = await indexDef(queryInterface);
    if (def && def.includes('partnership_base_fee') && def.includes('performance_fee')) return;
    await rebuild(queryInterface, FIVE);
  },

  async down(queryInterface) {
    const def = await indexDef(queryInterface);
    if (def && !def.includes('partnership_base_fee')) return;
    await rebuild(queryInterface, THREE);
  },
};
