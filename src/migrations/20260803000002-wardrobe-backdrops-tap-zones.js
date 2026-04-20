'use strict';

/**
 * Four new columns and one JSONB on wardrobe rows to support the
 * auto-generated colored-backdrop variants and tap-zone editor:
 *
 *   s3_key_bg_pink / s3_url_bg_pink
 *   s3_key_bg_blue / s3_url_bg_blue
 *   s3_key_bg_teal / s3_url_bg_teal
 *     — cutout composited onto pastel-pink, baby-blue, and teal-green
 *       canvases at the standard 1080x1350 (4:5 portrait) size. Generated
 *       asynchronously right after remove.bg finishes. Each variant
 *       independently present or absent — partial success writes what it can.
 *
 *   tap_zones JSONB (default [])
 *     — array of rectangles (normalized 0–1 coordinates so they survive
 *       any render size) with target metadata:
 *         [{ id, x, y, w, h, target_type, target, label }]
 *       Shared across all colored variants; defining zones once means
 *       switching pink→teal on a card doesn't lose that work.
 *
 *   display_price_on_phone BOOLEAN (default false)
 *     — opt-in per item. When true, Lala's phone renders the item's price
 *       alongside its image/tap zones. Default false so prices don't leak
 *       to viewers until an author explicitly decides.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('wardrobe', 's3_key_bg_pink', {
      type: Sequelize.STRING(500), allowNull: true,
      comment: 'S3 key for pastel-pink backdrop variant',
    });
    await queryInterface.addColumn('wardrobe', 's3_url_bg_pink', {
      type: Sequelize.TEXT, allowNull: true,
      comment: 'Full S3 URL for pastel-pink backdrop variant',
    });

    await queryInterface.addColumn('wardrobe', 's3_key_bg_blue', {
      type: Sequelize.STRING(500), allowNull: true,
      comment: 'S3 key for baby-blue backdrop variant',
    });
    await queryInterface.addColumn('wardrobe', 's3_url_bg_blue', {
      type: Sequelize.TEXT, allowNull: true,
      comment: 'Full S3 URL for baby-blue backdrop variant',
    });

    await queryInterface.addColumn('wardrobe', 's3_key_bg_teal', {
      type: Sequelize.STRING(500), allowNull: true,
      comment: 'S3 key for teal-green backdrop variant',
    });
    await queryInterface.addColumn('wardrobe', 's3_url_bg_teal', {
      type: Sequelize.TEXT, allowNull: true,
      comment: 'Full S3 URL for teal-green backdrop variant',
    });

    await queryInterface.addColumn('wardrobe', 'tap_zones', {
      type: Sequelize.JSONB, allowNull: true, defaultValue: [],
      comment: 'Array of tap-zone rects (normalized 0–1 coords) shared across colored variants',
    });

    await queryInterface.addColumn('wardrobe', 'display_price_on_phone', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
      comment: 'When true, Lala\'s phone renders the price alongside this item',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('wardrobe', 'display_price_on_phone');
    await queryInterface.removeColumn('wardrobe', 'tap_zones');
    await queryInterface.removeColumn('wardrobe', 's3_url_bg_teal');
    await queryInterface.removeColumn('wardrobe', 's3_key_bg_teal');
    await queryInterface.removeColumn('wardrobe', 's3_url_bg_blue');
    await queryInterface.removeColumn('wardrobe', 's3_key_bg_blue');
    await queryInterface.removeColumn('wardrobe', 's3_url_bg_pink');
    await queryInterface.removeColumn('wardrobe', 's3_key_bg_pink');
  },
};
