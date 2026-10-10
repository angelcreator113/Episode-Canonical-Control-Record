'use strict';

/**
 * website_slots: the public landing page's media slots (Task #2821; data
 * shape in docs/reads/2026-10-10-website-content-read.md §3). One live row
 * per fixed slot key; files live under the public site prefix, never in the
 * studio's buckets. Only published rows are ever served publicly
 * (GET /api/v1/public/site-content).
 *
 * New table only, with deleted_at. Guarded: created only when absent.
 * down drops it.
 */

const TABLE = 'website_slots';

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
        slot_key: { type: Sequelize.STRING(40), allowNull: false },
        media_type: { type: Sequelize.STRING(20), allowNull: true },
        file_key: { type: Sequelize.TEXT, allowNull: true },
        youtube_id: { type: Sequelize.STRING(20), allowNull: true },
        poster_key: { type: Sequelize.TEXT, allowNull: true },
        captions_key: { type: Sequelize.TEXT, allowNull: true },
        alt_text: { type: Sequelize.STRING(300), allowNull: true },
        has_speech: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        duration_seconds: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
        file_size_bytes: { type: Sequelize.INTEGER, allowNull: true },
        content_type: { type: Sequelize.STRING(50), allowNull: true },
        status: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'draft' },
        published_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction });
      await sequelize.query(
        `ALTER TABLE website_slots ADD CONSTRAINT website_slots_slot_key_check CHECK (slot_key IN (
           'hero', 'flagship_lala', 'pillar_fashion', 'pillar_characters', 'pillar_places', 'featured_video',
           'brand_world', 'brand_books', 'brand_studio', 'brand_fashion', 'logo'))`, { transaction });
      await sequelize.query(
        `ALTER TABLE website_slots ADD CONSTRAINT website_slots_media_type_check
           CHECK (media_type IS NULL OR media_type IN ('image', 'video_clip', 'youtube'))`, { transaction });
      await sequelize.query(
        `ALTER TABLE website_slots ADD CONSTRAINT website_slots_status_check CHECK (status IN ('draft', 'published'))`, { transaction });
      // A slot is a YouTube video or an uploaded file, never both.
      await sequelize.query(
        `ALTER TABLE website_slots ADD CONSTRAINT website_slots_one_source_check
           CHECK (NOT (youtube_id IS NOT NULL AND file_key IS NOT NULL))`, { transaction });
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS website_slots_unique_key
           ON website_slots (slot_key) WHERE deleted_at IS NULL`, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, TABLE)) await queryInterface.dropTable(TABLE);
  },
};
