'use strict';

/**
 * season_reveals (Evoni, 2026-10-17, stage E of the storytelling plan: the
 * season blueprint; "Inner Life + Season Blueprint -> Episode -> Short
 * Story -> Chapter Book, with continuity and revelation permissions checked
 * at every stage").
 *
 * The reveal plan: which kept secret (character_secrets) the season hints
 * at or reveals in which slot (season_slots).
 *   intent  hint | reveal
 *   note    how, in Evoni's words (optional)
 * One plan row per slot and secret. When the slot's episode is written,
 * its writers (episode script and story) read the plan as that episode's
 * permission for the secret; the chapter writer reads the whole plan.
 *
 * Raw SQL in services/seasonRevealPlan; no model. Guarded: created only
 * when absent. down drops it.
 */

const TABLE = 'season_reveals';

const tableExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${name}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, TABLE, transaction)) return;
      await queryInterface.createTable(TABLE, {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
        show_id: { type: Sequelize.UUID, allowNull: false },
        slot_id: { type: Sequelize.UUID, allowNull: false },
        secret_id: { type: Sequelize.UUID, allowNull: false },
        intent: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'hint' },
        note: { type: Sequelize.TEXT, allowNull: true },
        created_by: { type: Sequelize.STRING(255), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${TABLE}_slot_secret ON ${TABLE} (slot_id, secret_id) WHERE deleted_at IS NULL`,
        { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_show ON ${TABLE} (show_id) WHERE deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
