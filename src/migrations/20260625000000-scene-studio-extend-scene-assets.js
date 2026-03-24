'use strict';

/**
 * Scene Studio Migration
 *
 * Extends scene_assets with canvas transform fields (rotation, dimensions, visibility, lock, etc.)
 * Creates scene_object_variants table for object variant groups
 * Adds canvas_settings JSONB to scenes
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ── 1. Extend scene_assets with Scene Studio fields ──
    await queryInterface.addColumn('scene_assets', 'rotation', {
      type: Sequelize.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Rotation in degrees (0-360)',
    });

    await queryInterface.addColumn('scene_assets', 'width', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Pixel width on canvas',
    });

    await queryInterface.addColumn('scene_assets', 'height', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Pixel height on canvas',
    });

    await queryInterface.addColumn('scene_assets', 'is_visible', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether object is visible on canvas',
    });

    await queryInterface.addColumn('scene_assets', 'is_locked', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether object is locked from editing',
    });

    await queryInterface.addColumn('scene_assets', 'object_type', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: 'image',
      comment: 'Object type: image, video, text, shape, overlay, decor',
    });

    await queryInterface.addColumn('scene_assets', 'object_label', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'User-facing name (e.g., "Chandelier", "Wall Art")',
    });

    await queryInterface.addColumn('scene_assets', 'flip_x', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Horizontal flip',
    });

    await queryInterface.addColumn('scene_assets', 'flip_y', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Vertical flip',
    });

    await queryInterface.addColumn('scene_assets', 'crop_data', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Crop rectangle: { x, y, width, height }',
    });

    await queryInterface.addColumn('scene_assets', 'style_data', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Style properties: { fill, stroke, strokeWidth, fontSize, fontFamily, textContent, shadow }',
    });

    await queryInterface.addColumn('scene_assets', 'group_id', {
      type: Sequelize.UUID,
      allowNull: true,
      comment: 'Group ID for grouped objects',
    });

    await queryInterface.addColumn('scene_assets', 'variant_group_id', {
      type: Sequelize.UUID,
      allowNull: true,
      comment: 'Links objects that are variants of each other',
    });

    await queryInterface.addColumn('scene_assets', 'variant_label', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Variant label: "open", "closed", "day", "night"',
    });

    await queryInterface.addColumn('scene_assets', 'is_active_variant', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Only one variant per group is active/visible',
    });

    // Add indexes for new columns
    await queryInterface.addIndex('scene_assets', ['object_type'], {
      name: 'idx_scene_assets_object_type',
    });

    await queryInterface.addIndex('scene_assets', ['variant_group_id'], {
      name: 'idx_scene_assets_variant_group_id',
    });

    await queryInterface.addIndex('scene_assets', ['group_id'], {
      name: 'idx_scene_assets_group_id',
    });

    await queryInterface.addIndex('scene_assets', ['is_visible'], {
      name: 'idx_scene_assets_is_visible',
    });

    // ── 2. Create scene_object_variants table ──
    await queryInterface.createTable('scene_object_variants', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      scene_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'scenes', key: 'id' },
        onDelete: 'CASCADE',
      },
      variant_group_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Human-readable group name: "Curtains", "Chandelier Style", "Lighting Mood"',
      },
      active_variant_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'scene_assets', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'Which variant is currently shown',
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Extra configuration for the variant group',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('scene_object_variants', ['scene_id'], {
      name: 'idx_scene_object_variants_scene_id',
    });

    await queryInterface.addIndex('scene_object_variants', ['active_variant_id'], {
      name: 'idx_scene_object_variants_active_variant_id',
    });

    // ── 3. Add canvas_settings to scenes ──
    await queryInterface.addColumn('scenes', 'canvas_settings', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Scene Studio canvas settings: { zoom, panX, panY, gridVisible, snapEnabled, backgroundColor, statePresets }',
    });
  },

  async down(queryInterface) {
    // Remove canvas_settings from scenes
    await queryInterface.removeColumn('scenes', 'canvas_settings');

    // Drop scene_object_variants table
    await queryInterface.dropTable('scene_object_variants');

    // Remove indexes
    await queryInterface.removeIndex('scene_assets', 'idx_scene_assets_is_visible').catch(() => {});
    await queryInterface.removeIndex('scene_assets', 'idx_scene_assets_group_id').catch(() => {});
    await queryInterface.removeIndex('scene_assets', 'idx_scene_assets_variant_group_id').catch(() => {});
    await queryInterface.removeIndex('scene_assets', 'idx_scene_assets_object_type').catch(() => {});

    // Remove columns from scene_assets (reverse order)
    const columnsToRemove = [
      'is_active_variant', 'variant_label', 'variant_group_id', 'group_id',
      'style_data', 'crop_data', 'flip_y', 'flip_x', 'object_label',
      'object_type', 'is_locked', 'is_visible', 'height', 'width', 'rotation',
    ];

    for (const col of columnsToRemove) {
      await queryInterface.removeColumn('scene_assets', col);
    }
  },
};
