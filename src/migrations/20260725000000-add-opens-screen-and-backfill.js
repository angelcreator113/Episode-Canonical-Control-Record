'use strict';

/**
 * Add opens_screen column to ui_overlay_types for icon→screen navigation.
 * Also backfills ui_overlay_types rows from existing overlay assets so
 * removing hardcoded OVERLAY_TYPES doesn't orphan any data.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add opens_screen column — references another type_key in the same show
    await queryInterface.addColumn('ui_overlay_types', 'opens_screen', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'type_key of the screen this icon navigates to (same show)',
    });

    // 2. Backfill: for every UI_OVERLAY asset that has no matching ui_overlay_types row,
    //    create one so the asset stays visible after hardcoded types are removed.
    await queryInterface.sequelize.query(`
      INSERT INTO ui_overlay_types (id, show_id, type_key, name, category, description, prompt, sort_order, created_at, updated_at)
      SELECT
        gen_random_uuid(),
        a.show_id,
        COALESCE(
          a.metadata->>'overlay_type',
          LOWER(REGEXP_REPLACE(REPLACE(a.name, 'UI Overlay: ', ''), '[^a-zA-Z0-9]+', '_', 'g'))
        ),
        COALESCE(REPLACE(a.name, 'UI Overlay: ', ''), a.metadata->>'overlay_type', 'Unknown'),
        COALESCE(a.metadata->>'overlay_category', 'phone'),
        'Auto-created from existing asset',
        'User-uploaded or previously generated overlay',
        100,
        NOW(),
        NOW()
      FROM assets a
      WHERE a.asset_type = 'UI_OVERLAY'
        AND a.deleted_at IS NULL
        AND a.show_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM ui_overlay_types t
          WHERE t.show_id = a.show_id
            AND t.type_key = COALESCE(
              a.metadata->>'overlay_type',
              LOWER(REGEXP_REPLACE(REPLACE(a.name, 'UI Overlay: ', ''), '[^a-zA-Z0-9]+', '_', 'g'))
            )
            AND t.deleted_at IS NULL
        )
      ON CONFLICT DO NOTHING
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ui_overlay_types', 'opens_screen');
    // Note: backfilled rows are not removed on down — they're valid data
  },
};
