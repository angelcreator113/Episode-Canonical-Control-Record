/**
 * Add deleted_at column to thumbnail_compositions table for soft deletes
 * This brings thumbnail_compositions in line with other tables like episodes
 */

exports.up = (pgm) => {
  pgm.addColumns('thumbnail_compositions', {
    deleted_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'Soft delete timestamp - null means record is active',
    },
  });

  pgm.createIndex('thumbnail_compositions', 'deleted_at', {
    name: 'idx_thumbnail_compositions_deleted_at',
  });

  console.log('✅ Added deleted_at column to thumbnail_compositions table');
};

exports.down = (pgm) => {
  pgm.dropIndex('thumbnail_compositions', 'deleted_at', {
    name: 'idx_thumbnail_compositions_deleted_at',
  });

  pgm.dropColumns('thumbnail_compositions', ['deleted_at']);

  console.log('✅ Removed deleted_at column from thumbnail_compositions table');
};
