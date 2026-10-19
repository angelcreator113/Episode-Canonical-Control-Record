'use strict';

/**
 * Visual Memory, phase 4, as Evoni ruled it (2026-10-19): the caption's
 * reading kept apart from the post's review notes, and a structured record of
 * what each made picture was made from. services/pictureSuggestions reads and
 * writes both.
 *
 *   post_picture_suggestions   one per (post, caption) among live rows: the
 *                              reading of that caption, so a re-review of the
 *                              post (which rewrites feed_posts.gate_json)
 *                              never erases it or pays for another reading.
 *                              A changed caption is a new row.
 *     post_id, caption_hash, model, reading
 *     recommended_action   use | edit | create (the latest plan)
 *     recommended_asset_id, score
 *     chosen_action        use | edit | create | upload (what Evoni did)
 *     chosen_asset_id      the picture she used or edited
 *     result_asset_id      the picture that came of it (an edit, a new one,
 *                          an upload)
 *     chosen_at, timestamps, deleted_at
 *   media_asset_sources        what a made picture was made from, one row per
 *                              reference used: the place picture it keeps,
 *                              the portraits that hold the face, the picture
 *                              a variation was made from. A place reference
 *                              is not a variation (parent_asset_id stays
 *                              empty), but it is kept here so the same
 *                              kitchen stays the same kitchen.
 *     asset_id, source_asset_id (null for a portrait not in the library),
 *     role (place | portrait | parent), character_id (whose portrait),
 *     source_url (the portrait's address when it is not in the library),
 *     created_by, timestamps, deleted_at
 *
 * down: drops the two tables, nothing else.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('post_picture_suggestions', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
        post_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'feed_posts', key: 'id' }, onDelete: 'CASCADE' },
        caption_hash: { type: Sequelize.STRING(64), allowNull: false },
        model: { type: Sequelize.STRING(64), allowNull: true },
        reading: { type: Sequelize.JSONB, allowNull: false },
        recommended_action: { type: Sequelize.STRING(10), allowNull: true },
        recommended_asset_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'media_assets', key: 'id' }, onDelete: 'SET NULL' },
        score: { type: Sequelize.INTEGER, allowNull: true },
        chosen_action: { type: Sequelize.STRING(10), allowNull: true },
        chosen_asset_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'media_assets', key: 'id' }, onDelete: 'SET NULL' },
        result_asset_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'media_assets', key: 'id' }, onDelete: 'SET NULL' },
        chosen_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction: t });
      await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX post_picture_suggestions_live ON post_picture_suggestions (post_id, caption_hash) WHERE deleted_at IS NULL', { transaction: t });
      await queryInterface.sequelize.query(
        "ALTER TABLE post_picture_suggestions ADD CONSTRAINT post_picture_suggestions_recommended_check CHECK (recommended_action IS NULL OR recommended_action IN ('use', 'edit', 'create'))", { transaction: t });
      await queryInterface.sequelize.query(
        "ALTER TABLE post_picture_suggestions ADD CONSTRAINT post_picture_suggestions_chosen_check CHECK (chosen_action IS NULL OR chosen_action IN ('use', 'edit', 'create', 'upload'))", { transaction: t });

      await queryInterface.createTable('media_asset_sources', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
        asset_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'media_assets', key: 'id' }, onDelete: 'CASCADE' },
        source_asset_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'media_assets', key: 'id' }, onDelete: 'SET NULL' },
        role: { type: Sequelize.STRING(16), allowNull: false },
        character_id: { type: Sequelize.UUID, allowNull: true },
        source_url: { type: Sequelize.TEXT, allowNull: true },
        created_by: { type: Sequelize.STRING(100), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction: t });
      await queryInterface.sequelize.query(
        "ALTER TABLE media_asset_sources ADD CONSTRAINT media_asset_sources_role_check CHECK (role IN ('place', 'portrait', 'parent'))", { transaction: t });
      await queryInterface.sequelize.query(
        'CREATE INDEX media_asset_sources_asset ON media_asset_sources (asset_id) WHERE deleted_at IS NULL', { transaction: t });
      await queryInterface.sequelize.query(
        'CREATE INDEX media_asset_sources_source ON media_asset_sources (source_asset_id, role) WHERE deleted_at IS NULL', { transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('media_asset_sources');
    await queryInterface.dropTable('post_picture_suggestions');
  },
};
