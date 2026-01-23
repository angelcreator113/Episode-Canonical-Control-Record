/**
 * Migration: Add Library Columns to Existing Tables
 * Adds library_item_id reference to wardrobe table and approval/override columns to episode_wardrobe
 */

exports.up = (pgm) => {
  // 1. Add library_item_id to wardrobe table
  pgm.addColumn('wardrobe', {
    library_item_id: {
      type: 'integer',
      references: 'wardrobe_library',
      onDelete: 'SET NULL',
    },
  });

  pgm.createIndex('wardrobe', 'library_item_id', { name: 'idx_wardrobe_library_item' });

  // 2. Add approval columns to episode_wardrobe table
  pgm.addColumn('episode_wardrobe', {
    approval_status: {
      type: 'varchar(50)',
      default: 'pending',
      comment: 'pending, approved, rejected',
    },
    approved_by: {
      type: 'varchar(255)',
    },
    approved_at: {
      type: 'timestamp',
    },
    rejection_reason: {
      type: 'text',
    },
  });

  // 3. Add override columns to episode_wardrobe (NULL means use library defaults)
  pgm.addColumn('episode_wardrobe', {
    override_character: {
      type: 'varchar(255)',
    },
    override_occasion: {
      type: 'varchar(255)',
    },
    override_season: {
      type: 'varchar(100)',
    },
  });

  // 4. Add scene_id to episode_wardrobe
  pgm.addColumn('episode_wardrobe', {
    scene_id: {
      type: 'uuid',
      references: 'scenes',
      onDelete: 'SET NULL',
    },
  });

  // 5. Create indexes
  pgm.createIndex('episode_wardrobe', 'approval_status', {
    name: 'idx_episode_wardrobe_approval',
  });
  pgm.createIndex('episode_wardrobe', 'scene_id', { name: 'idx_episode_wardrobe_scene' });
};

exports.down = (pgm) => {
  // Drop indexes first
  pgm.dropIndex('episode_wardrobe', 'scene_id', { name: 'idx_episode_wardrobe_scene', ifExists: true });
  pgm.dropIndex('episode_wardrobe', 'approval_status', {
    name: 'idx_episode_wardrobe_approval',
    ifExists: true,
  });
  pgm.dropIndex('wardrobe', 'library_item_id', { name: 'idx_wardrobe_library_item', ifExists: true });

  // Drop columns
  pgm.dropColumn('episode_wardrobe', 'scene_id', { ifExists: true });
  pgm.dropColumn('episode_wardrobe', 'override_season', { ifExists: true });
  pgm.dropColumn('episode_wardrobe', 'override_occasion', { ifExists: true });
  pgm.dropColumn('episode_wardrobe', 'override_character', { ifExists: true });
  pgm.dropColumn('episode_wardrobe', 'rejection_reason', { ifExists: true });
  pgm.dropColumn('episode_wardrobe', 'approved_at', { ifExists: true });
  pgm.dropColumn('episode_wardrobe', 'approved_by', { ifExists: true });
  pgm.dropColumn('episode_wardrobe', 'approval_status', { ifExists: true });
  pgm.dropColumn('wardrobe', 'library_item_id', { ifExists: true });
};
