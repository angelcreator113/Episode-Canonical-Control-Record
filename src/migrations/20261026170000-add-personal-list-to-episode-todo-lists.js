'use strict';

/**
 * My Little List ♡ (Evoni, 2026-10-26, Phase 1): Lala's own reminders and
 * the approved wording of her list, on the episode's list row
 * (services/myLittleListService):
 *
 *   episode_todo_lists.personal_list   JSONB NOT NULL DEFAULT '{}'
 *     reminders   [{ id, title, note, reveal: { when, ref }, done, created_at }]
 *     words       { <item ref>: { title, title_considering, note } }
 *
 * Kept apart from social_tasks on purpose: her reminders count toward no
 * score, stat, deliverable or payout, and nothing that reads social_tasks
 * sees them.
 *
 * An added column, so no deleted_at (the table has its own). Guarded: added
 * only when absent. down drops it.
 *
 * Runs only through Evoni's Deploy workflow. Until it has, the list still
 * reads (myLittleListService.hasPersonalList leaves the column out of the
 * query and the list has no reminders or wording), and every write answers
 * 503 PERSONAL_LIST_MIGRATION_PENDING.
 */

const TABLE = 'episode_todo_lists';
const COLUMN = 'personal_list';

const columnExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query(
    'SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column',
    { replacements: { table: TABLE, column: COLUMN }, transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await columnExists(sequelize, transaction))) {
        await queryInterface.addColumn(TABLE, COLUMN, {
          type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'{}'::jsonb"),
        }, { transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await columnExists(sequelize, transaction)) {
        await queryInterface.removeColumn(TABLE, COLUMN, { transaction });
      }
    });
  },
};
