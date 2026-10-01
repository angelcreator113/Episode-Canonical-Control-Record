'use strict';

/**
 * The episode's money plan at Start Episode (Episode Money Phase B, MB6;
 * Evoni's rulings and answers, 2026-10-01; docs/EVENT_EPISODE_FLOW.md
 * §8(gg); build PR 4 of docs/EPISODE_MONEY_PHASE_B_NOTE.md).
 *
 *   MB6. "After Complete, a reconciliation view compares planned with
 *   posted per line and highlights differences (a bonus not earned, a
 *   spending line changed)."
 *   Q7 (accepted as recommended). Snapshot the line list at Start Episode,
 *   with amounts and states, on the episode, the way season_context is;
 *   the reconciliation compares that snapshot with what posted.
 *
 * episodes.money_plan (JSONB, nullable):
 *   { taken_at, balance, lines: [{ key, kind, category, label, amount,
 *     trigger, payer, conditional, covered, covered_amount, tier, state,
 *     source, drafted }] }
 * written by episodeMoneyService.snapshotMoneyPlan after Start Episode.
 * No backfill: an episode started before this has no plan, and its
 * reconciliation says so.
 *
 * Guarded: the column is added only when absent, so a re-run changes
 * nothing. down drops the column.
 */

const tableExists = async (sequelize, table, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${table}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

const hasColumn = async (sequelize, transaction) => {
  const [cols] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'episodes' AND column_name = 'money_plan'`,
    { transaction });
  return cols.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, 'episodes', transaction))) return;
      if (!(await hasColumn(sequelize, transaction))) {
        await queryInterface.addColumn('episodes', 'money_plan', { type: Sequelize.JSONB, allowNull: true }, { transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, 'episodes') && await hasColumn(sequelize)) {
      await queryInterface.removeColumn('episodes', 'money_plan');
    }
  },
};
