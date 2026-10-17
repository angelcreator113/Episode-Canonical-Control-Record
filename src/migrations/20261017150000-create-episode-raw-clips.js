'use strict';

/**
 * episode_raw_clips: the episode's raw, unedited video clips, uploaded on the
 * episode's Assets → Files tab (Evoni, 2026-10-17). Each clip names who is
 * on camera (performer: 'lala', 'justawoman' or 'guest', with an optional
 * guest_name), keeps the original file untouched (s3_key_raw) and, when the
 * clip was filmed on a green screen, a cut-out copy with the green removed
 * (s3_key_cutout, a WebM with an alpha channel). Green removal is ffmpeg's
 * chromakey on the server: no outside service, no per-clip cost.
 *
 * key_status: none (not asked), queued, processing, done, failed.
 * key_strength: low, medium, high (how far from pure green still keys out).
 * Raw SQL in rawClipsService, like episode_performance_clips; no model.
 *
 * Guarded: created only when absent. down drops the table.
 */

const TABLE = 'episode_raw_clips';

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
        show_id: { type: Sequelize.UUID, allowNull: true },
        performer: { type: Sequelize.STRING(20), allowNull: false },
        guest_name: { type: Sequelize.STRING(200), allowNull: true },
        label: { type: Sequelize.STRING(200), allowNull: true },
        original_filename: { type: Sequelize.STRING(255), allowNull: true },
        content_type: { type: Sequelize.STRING(100), allowNull: true },
        file_size_bytes: { type: Sequelize.BIGINT, allowNull: true },
        duration_seconds: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        width: { type: Sequelize.INTEGER, allowNull: true },
        height: { type: Sequelize.INTEGER, allowNull: true },
        s3_key_raw: { type: Sequelize.TEXT, allowNull: false },
        url_raw: { type: Sequelize.TEXT, allowNull: true },
        thumbnail_key: { type: Sequelize.TEXT, allowNull: true },
        thumbnail_url: { type: Sequelize.TEXT, allowNull: true },
        key_status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'none' },
        key_strength: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'medium' },
        s3_key_cutout: { type: Sequelize.TEXT, allowNull: true },
        url_cutout: { type: Sequelize.TEXT, allowNull: true },
        key_error: { type: Sequelize.TEXT, allowNull: true },
        key_started_at: { type: Sequelize.DATE, allowNull: true },
        key_finished_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        `ALTER TABLE ${TABLE}
           ADD CONSTRAINT ${TABLE}_performer CHECK (performer IN ('lala', 'justawoman', 'guest')),
           ADD CONSTRAINT ${TABLE}_key_status CHECK (key_status IN ('none', 'queued', 'processing', 'done', 'failed')),
           ADD CONSTRAINT ${TABLE}_key_strength CHECK (key_strength IN ('low', 'medium', 'high'))`,
        { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${TABLE}_episode ON ${TABLE} (episode_id, created_at) WHERE deleted_at IS NULL`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, TABLE)) await queryInterface.dropTable(TABLE);
  },
};
