'use strict';

/**
 * episode_thumbnail_versions: an episode's thumbnail kept as named versions
 * to compare (Evoni, 2026-10-21: "versions to compare"), e.g. "Version A"
 * with the red dress, "Version B" with the gold. spec is the layers
 * ({ version: 2, layers }, thumbnailLayers.readLayers); preview_url a small
 * picture of it in S3. The episode's working arrangement stays its draft
 * (episode_thumbnail_drafts); a version is a copy kept beside it.
 *
 * Raw SQL in youtubeThumbnailService; no model.
 *
 * Guarded: created only when absent. down drops the table.
 */

const TABLE = 'episode_thumbnail_versions';

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
        episode_id: { type: Sequelize.UUID, allowNull: false },
        name: { type: Sequelize.STRING(80), allowNull: false },
        spec: { type: Sequelize.JSONB, allowNull: false },
        preview_url: { type: Sequelize.TEXT, allowNull: true },
        created_by: { type: Sequelize.STRING(255), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      // A name once per episode, whatever its case.
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${TABLE}_name_per_episode ON ${TABLE} (episode_id, lower(name)) WHERE deleted_at IS NULL`,
        { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_episode ON ${TABLE} (episode_id) WHERE deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, TABLE)) await queryInterface.dropTable(TABLE);
  },
};
