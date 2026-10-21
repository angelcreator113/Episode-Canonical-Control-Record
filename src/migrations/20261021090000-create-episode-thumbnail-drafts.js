'use strict';

/**
 * episode_thumbnail_drafts: an episode's thumbnail as it is being arranged
 * in Templates › YouTube thumbnails (Evoni, 2026-10-21: the show's layout
 * is its template; what she moves, resizes or turns on one episode stays
 * with that episode). One live draft per episode: spec is the layers
 * ({ version: 2, layers }, thumbnailLayers.readLayers). Saving the episode's
 * thumbnail renders it; the draft stays so it can be changed again.
 *
 * Raw SQL in youtubeThumbnailService; no model.
 *
 * Guarded: created only when absent. down drops the table.
 */

const TABLE = 'episode_thumbnail_drafts';

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
        spec: { type: Sequelize.JSONB, allowNull: false },
        updated_by: { type: Sequelize.STRING(255), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      // One live draft per episode.
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${TABLE}_one_per_episode ON ${TABLE} (episode_id) WHERE deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, TABLE)) await queryInterface.dropTable(TABLE);
  },
};
