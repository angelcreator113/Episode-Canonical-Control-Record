'use strict';

/**
 * The episode's Lookbook (docs/design/2026-10-landing-and-stylesheet.md
 * Part 2; plan in docs/reads/2026-10-10-lookbook-stylesheet-read.md §4;
 * Task #2812). "Hair, nails and beauty are fields on the episode's look,
 * not closet items."
 *
 *   episode_lookbooks        one live row per episode: hair and nails
 *                            names, beauty notes, palette, mood words,
 *                            tagline, and the style sheet's status.
 *   episode_lookbook_images  her photos sorted into the sheet's spots
 *                            (front, side, back, hero, hair, nails, eyes,
 *                            lips, skin, venue, inspo; "unsorted" is the
 *                            To sort tray). A single-photo spot holds one
 *                            live row; a replace soft-deletes the old one.
 *
 * New tables only; wardrobe pieces and scene sets are untouched (venue
 * images point at them, nothing is copied). Guarded: each table is created
 * only when absent. down drops both.
 */

const LOOKBOOKS = 'episode_lookbooks';
const IMAGES = 'episode_lookbook_images';

const tableExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${name}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

const fk = (table, onDelete = 'SET NULL') => ({ references: { model: table, key: 'id' }, onDelete, onUpdate: 'CASCADE' });

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, LOOKBOOKS, transaction))) {
        await queryInterface.createTable(LOOKBOOKS, {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          episode_id: { type: Sequelize.UUID, allowNull: false, ...fk('episodes', 'CASCADE') },
          show_id: { type: Sequelize.UUID, allowNull: true, ...fk('shows') },
          hair_name: { type: Sequelize.STRING(120), allowNull: true },
          nails_name: { type: Sequelize.STRING(120), allowNull: true },
          beauty_notes: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
          palette: { type: Sequelize.JSONB, allowNull: true },
          mood_words: { type: Sequelize.JSONB, allowNull: true },
          tagline: { type: Sequelize.STRING(200), allowNull: true },
          sheet_status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'draft' },
          approved_at: { type: Sequelize.DATE, allowNull: true },
          approved_by: { type: Sequelize.STRING(255), allowNull: true },
          sheet_asset_id: { type: Sequelize.UUID, allowNull: true, ...fk('assets') },
          sheet_inputs_hash: { type: Sequelize.STRING(64), allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
        await sequelize.query(
          `ALTER TABLE episode_lookbooks ADD CONSTRAINT episode_lookbooks_sheet_status_check
             CHECK (sheet_status IN ('draft', 'approved'))`, { transaction });
        await sequelize.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS episode_lookbooks_unique_episode
             ON episode_lookbooks (episode_id) WHERE deleted_at IS NULL`, { transaction });
      }

      if (!(await tableExists(sequelize, IMAGES, transaction))) {
        await queryInterface.createTable(IMAGES, {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          lookbook_id: { type: Sequelize.UUID, allowNull: false, ...fk('episode_lookbooks', 'CASCADE') },
          episode_id: { type: Sequelize.UUID, allowNull: false, ...fk('episodes', 'CASCADE') },
          category: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'unsorted' },
          source: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'upload' },
          image_url: { type: Sequelize.TEXT, allowNull: true },
          s3_key: { type: Sequelize.TEXT, allowNull: true },
          scene_set_id: { type: Sequelize.UUID, allowNull: true, ...fk('scene_sets') },
          scene_angle_id: { type: Sequelize.UUID, allowNull: true, ...fk('scene_angles') },
          scene_set_look_id: { type: Sequelize.UUID, allowNull: true, ...fk('scene_set_looks') },
          wardrobe_id: { type: Sequelize.UUID, allowNull: true, ...fk('wardrobe') },
          in_lookbook: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          content_type: { type: Sequelize.STRING(50), allowNull: true },
          width: { type: Sequelize.INTEGER, allowNull: true },
          height: { type: Sequelize.INTEGER, allowNull: true },
          file_size_bytes: { type: Sequelize.INTEGER, allowNull: true },
          file_name: { type: Sequelize.STRING(255), allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
        await sequelize.query(
          `ALTER TABLE episode_lookbook_images ADD CONSTRAINT episode_lookbook_images_category_check
             CHECK (category IN ('unsorted', 'front', 'side', 'back', 'hero', 'hair', 'nails', 'eyes', 'lips', 'skin', 'venue', 'inspo'))`,
          { transaction });
        await sequelize.query(
          `ALTER TABLE episode_lookbook_images ADD CONSTRAINT episode_lookbook_images_source_check
             CHECK (source IN ('upload', 'scene_set_look', 'scene_set_base', 'scene_angle', 'texture_auto'))`,
          { transaction });
        await sequelize.query(
          `CREATE INDEX IF NOT EXISTS episode_lookbook_images_episode_category
             ON episode_lookbook_images (episode_id, category) WHERE deleted_at IS NULL`, { transaction });
        await sequelize.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS episode_lookbook_images_single_slot
             ON episode_lookbook_images (lookbook_id, category)
             WHERE deleted_at IS NULL AND category IN ('front', 'side', 'back', 'hero', 'hair', 'nails', 'eyes', 'lips', 'skin')`,
          { transaction });
        await sequelize.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS episode_lookbook_images_unique_angle
             ON episode_lookbook_images (lookbook_id, scene_angle_id)
             WHERE deleted_at IS NULL AND scene_angle_id IS NOT NULL`, { transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, IMAGES)) await queryInterface.dropTable(IMAGES);
    if (await tableExists(sequelize, LOOKBOOKS)) await queryInterface.dropTable(LOOKBOOKS);
  },
};
