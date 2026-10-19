'use strict';

/**
 * Visual Memory, phase 1 (Evoni's "Character Visual Memory System", 2026-10-18:
 * "Store media once in a shared asset library and link it across systems. A
 * single photo can belong to a gallery, post and episode without duplicating
 * the underlying file."). Two new tables; services/mediaLibrary reads and
 * writes them.
 *
 *   media_assets       one row per picture (one per URL among live rows: the
 *                      file is stored once, never copied)
 *     url, thumbnail_url, storage_key, width, height, caption
 *     source           upload | generated | portrait | cover | scene_set |
 *                      venue | invitation | event_set | post
 *     source_ref       where a carried-over picture came from
 *                      ("registry_characters:<id>:portrait_url")
 *     status           draft | approved | archived
 *     visibility       private | internal | public
 *     usage_rights     free text (whose it is, where it may be used)
 *     details          { objects, wardrobe, style, season, time_of_day,
 *                      camera_angle, notes }
 *     generation       { prompt, model, references } for a generated one
 *     parent_asset_id  the picture a variation was made from (phase 3)
 *     created_by, timestamps, deleted_at
 *   media_asset_links  what a picture is of or belongs to; one per
 *                      (asset, entity) among live rows
 *     asset_id, entity_type (character | scene_set | event | brand | post |
 *     episode | deal | wardrobe), entity_id (text: UUIDs and integer ids
 *     alike), role (pictured | owner | location), created_by, timestamps,
 *     deleted_at
 *
 * A picture is not a story fact: nothing here writes canon, attendance or
 * events. down: drops the two tables, nothing else.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('media_assets', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
        url: { type: Sequelize.TEXT, allowNull: false },
        thumbnail_url: { type: Sequelize.TEXT, allowNull: true },
        storage_key: { type: Sequelize.TEXT, allowNull: true },
        width: { type: Sequelize.INTEGER, allowNull: true },
        height: { type: Sequelize.INTEGER, allowNull: true },
        caption: { type: Sequelize.TEXT, allowNull: true },
        source: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'upload' },
        source_ref: { type: Sequelize.STRING(200), allowNull: true },
        status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'approved' },
        visibility: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'internal' },
        usage_rights: { type: Sequelize.TEXT, allowNull: true },
        details: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        generation: { type: Sequelize.JSONB, allowNull: true },
        parent_asset_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'media_assets', key: 'id' }, onDelete: 'SET NULL' },
        created_by: { type: Sequelize.STRING(100), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction: t });
      // One live row per picture. md5 so a long URL (a data: URL when storage
      // is not set up) still fits a btree index.
      await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX media_assets_url_live ON media_assets ((md5(url))) WHERE deleted_at IS NULL', { transaction: t });
      await queryInterface.sequelize.query(
        "ALTER TABLE media_assets ADD CONSTRAINT media_assets_status_check CHECK (status IN ('draft', 'approved', 'archived'))", { transaction: t });
      await queryInterface.sequelize.query(
        "ALTER TABLE media_assets ADD CONSTRAINT media_assets_visibility_check CHECK (visibility IN ('private', 'internal', 'public'))", { transaction: t });

      await queryInterface.createTable('media_asset_links', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
        asset_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'media_assets', key: 'id' }, onDelete: 'CASCADE' },
        entity_type: { type: Sequelize.STRING(20), allowNull: false },
        entity_id: { type: Sequelize.STRING(64), allowNull: false },
        role: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'pictured' },
        created_by: { type: Sequelize.STRING(100), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction: t });
      await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX media_asset_links_live ON media_asset_links (asset_id, entity_type, entity_id) WHERE deleted_at IS NULL', { transaction: t });
      await queryInterface.sequelize.query(
        'CREATE INDEX media_asset_links_entity ON media_asset_links (entity_type, entity_id) WHERE deleted_at IS NULL', { transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('media_asset_links');
    await queryInterface.dropTable('media_assets');
  },
};
