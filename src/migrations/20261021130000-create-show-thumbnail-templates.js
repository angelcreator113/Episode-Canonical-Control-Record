'use strict';

/**
 * show_thumbnail_templates: a show's named thumbnail templates (Evoni,
 * 2026-10-21: several per show, e.g. Come Style Me, Haul, GRWM, each with a
 * picture, renamed at will). spec is the layers ({ version: 2, layers },
 * thumbnailLayers.readLayers); preview_url a small picture of it in S3.
 * One default per show: the one an episode starts from. Until a show saves
 * one here, the template kept in shows.metadata.youtube_thumbnail stands in.
 *
 * Raw SQL in youtubeThumbnailService; no model.
 *
 * Guarded: created only when absent. down drops the table.
 */

const TABLE = 'show_thumbnail_templates';

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
        name: { type: Sequelize.STRING(80), allowNull: false },
        spec: { type: Sequelize.JSONB, allowNull: false },
        preview_url: { type: Sequelize.TEXT, allowNull: true },
        is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        created_by: { type: Sequelize.STRING(255), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      // A name once per show, whatever its case; one default per show.
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${TABLE}_name_per_show ON ${TABLE} (show_id, lower(name)) WHERE deleted_at IS NULL`,
        { transaction });
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${TABLE}_one_default ON ${TABLE} (show_id) WHERE is_default AND deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, TABLE)) await queryInterface.dropTable(TABLE);
  },
};
