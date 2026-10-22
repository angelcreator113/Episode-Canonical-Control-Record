'use strict';

/**
 * episode_saved_thumbnails: the thumbnails the Studio (Templates › YouTube
 * thumbnails) saves for an episode, the current one marked (Evoni,
 * 2026-10-22, on her phone: "Could not load the saved thumbnails (500:
 * column "s3Bucket" does not exist)").
 *
 * Production's `thumbnails` table is not the one 20240101000003 creates: it
 * has snake_case columns (s3_bucket, s3_key, episode_id) and its episode_id is
 * an integer, which cannot hold an episode's UUID (MEASURED in
 * docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt). The Studio's
 * saved list, its save, making one current, and a whole season all failed
 * there. This table is the Studio's own, the same on every database.
 *
 * Raw SQL in youtubeThumbnailService; no model.
 *
 * Guarded: created only when absent. down drops the table.
 */

const TABLE = 'episode_saved_thumbnails';

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
        url: { type: Sequelize.TEXT, allowNull: false },
        s3_bucket: { type: Sequelize.STRING(255), allowNull: true },
        s3_key: { type: Sequelize.STRING(512), allowNull: true },
        mime_type: { type: Sequelize.STRING(50), allowNull: true },
        file_size_bytes: { type: Sequelize.INTEGER, allowNull: true },
        width: { type: Sequelize.INTEGER, allowNull: true },
        height: { type: Sequelize.INTEGER, allowNull: true },
        is_current: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        created_by: { type: Sequelize.STRING(255), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      // One current thumbnail per episode.
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${TABLE}_current_per_episode ON ${TABLE} (episode_id) WHERE is_current AND deleted_at IS NULL`,
        { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_episode ON ${TABLE} (episode_id, created_at DESC) WHERE deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, TABLE)) await queryInterface.dropTable(TABLE);
  },
};
