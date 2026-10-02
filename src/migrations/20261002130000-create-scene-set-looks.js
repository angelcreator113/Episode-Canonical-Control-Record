'use strict';

/**
 * scene_set_looks: each event's dressed look on a venue's scene set
 * (Evoni's rulings L7-L9, 2026-10-02, and her answer 1;
 * docs/EVENT_EPISODE_FLOW.md §8(hh)):
 *
 *   L9. "On the Scene Sets page, a venue's set shows a Looks row: its
 *   approved base, then one card per event's dressed version, each naming
 *   its event."
 *   Answer 1. "a new table of looks, one current look per event per set,
 *   holding its image, brief, cost and status. The set's base image is
 *   never touched; regenerating an event's look replaces only that event's
 *   look."
 *
 * One live row per (scene_set_id, event_id) (a partial unique index); a
 * regenerated look updates its row. status: generating, complete, failed.
 * No backfill: the dressed versions made before this (S6) were written as
 * their set's base image, and stay there.
 *
 * Guarded: created only when absent. down drops the table.
 */

const TABLE = 'scene_set_looks';

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
        scene_set_id: { type: Sequelize.UUID, allowNull: false },
        event_id: { type: Sequelize.UUID, allowNull: false },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'generating' },
        image_url: { type: Sequelize.TEXT, allowNull: true },
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
        `CREATE UNIQUE INDEX IF NOT EXISTS scene_set_looks_unique_set_event
           ON scene_set_looks (scene_set_id, event_id) WHERE deleted_at IS NULL`,
        { transaction });
      await sequelize.query(
        'CREATE INDEX IF NOT EXISTS scene_set_looks_event ON scene_set_looks (event_id) WHERE deleted_at IS NULL',
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, TABLE)) await queryInterface.dropTable(TABLE);
  },
};
