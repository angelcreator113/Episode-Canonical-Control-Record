'use strict';

/**
 * location_look_variants: a venue's everyday look at each time of day and
 * in each season (Evoni, 2026-10-15: "Each venue needs its everyday look
 * and then its event look ... also the time of day and seasons"; time of
 * day changes every view, season only exterior views;
 * docs/VENUE_EVERYDAY_AND_EVENT_LOOKS_PLAN.md step 2).
 *
 * Variants belong to the everyday set they were made for (scene_set_id,
 * the location's approved set at the time): choosing another everyday look
 * does not carry the old one's variants over. One live row per
 * (scene_set_id, kind, value), a partial unique index; regenerating or
 * re-uploading updates it. A season remembers the Front angle it shows
 * (source_angle_id), so it replaces that view only.
 *   kind 'time':   morning, afternoon, golden_hour, evening, night
 *                  (a re-light of the everyday look)
 *   kind 'season': spring, summer, fall, winter (a re-season of the
 *                  venue's Front view: season shows outside)
 *   status: generating, complete, failed. source: generated, uploaded.
 *
 * Guarded: created only when absent. down drops the table.
 */

const TABLE = 'location_look_variants';

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
        world_location_id: { type: Sequelize.UUID, allowNull: false },
        scene_set_id: { type: Sequelize.UUID, allowNull: false },
        source_angle_id: { type: Sequelize.UUID, allowNull: true },
        kind: { type: Sequelize.STRING(10), allowNull: false },
        value: { type: Sequelize.STRING(20), allowNull: false },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'generating' },
        source: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'generated' },
        image_url: { type: Sequelize.TEXT, allowNull: true },
        source_image_url: { type: Sequelize.TEXT, allowNull: true },
        prompt: { type: Sequelize.TEXT, allowNull: true },
        estimate_usd: { type: Sequelize.DECIMAL(10, 4), allowNull: true },
        cost_usd: { type: Sequelize.DECIMAL(10, 4), allowNull: true },
        error: { type: Sequelize.TEXT, allowNull: true },
        generated_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS location_look_variants_unique
           ON location_look_variants (scene_set_id, kind, value) WHERE deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, TABLE)) await queryInterface.dropTable(TABLE);
  },
};
