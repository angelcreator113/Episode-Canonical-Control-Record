'use strict';

/**
 * scene_set_look_angles: an event's dressed angles, one per look per angle
 * (Evoni's ruling L10 and her answers, 2026-10-02;
 * docs/EVENT_EPISODE_FLOW.md §8(hh)):
 *
 *   L10. "When an event has a dressed look, its episode's angles at that
 *   venue are made from the dressed look instead of the plain approved
 *   base (the look is the episode's room); without a look, the approved
 *   base is used as today."
 *   Answer 1. "Dressed angles stored per look in a new table, so the set's
 *   angles stay plain."
 *
 * One live row per (look_id, scene_angle_id) (a partial unique index); a
 * regenerated or re-uploaded dressed angle updates its row. status:
 * generating, complete, failed. The scene_angles rows are never written.
 *
 * Guarded: created only when absent. down drops the table.
 */

const TABLE = 'scene_set_look_angles';

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
        look_id: { type: Sequelize.UUID, allowNull: false },
        scene_angle_id: { type: Sequelize.UUID, allowNull: false },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'generating' },
        image_url: { type: Sequelize.TEXT, allowNull: true },
        source: { type: Sequelize.STRING(20), allowNull: true },
        brief: { type: Sequelize.JSONB, allowNull: true },
        estimate_usd: { type: Sequelize.DECIMAL(10, 4), allowNull: true },
        cost_usd: { type: Sequelize.DECIMAL(10, 4), allowNull: true },
        error: { type: Sequelize.TEXT, allowNull: true },
        generated_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS scene_set_look_angles_unique_look_angle
           ON scene_set_look_angles (look_id, scene_angle_id) WHERE deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, TABLE)) await queryInterface.dropTable(TABLE);
  },
};
