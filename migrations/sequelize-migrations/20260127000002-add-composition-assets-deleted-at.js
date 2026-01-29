/**
 * Add deleted_at column to composition_assets table for soft deletes
 * This brings composition_assets in line with other tables
 */

exports.up = (pgm) => {
  pgm.addColumns('composition_assets', {
    deleted_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'Soft delete timestamp - null means record is active',
    },
  });

  pgm.createIndex('composition_assets', 'deleted_at', {
    name: 'idx_composition_assets_deleted_at',
  });

  console.log('✅ Added deleted_at column to composition_assets table');
};

exports.down = (pgm) => {
  pgm.dropIndex('composition_assets', 'deleted_at', {
    name: 'idx_composition_assets_deleted_at',
  });

  pgm.dropColumns('composition_assets', ['deleted_at']);

  console.log('✅ Removed deleted_at column from composition_assets table');
};
