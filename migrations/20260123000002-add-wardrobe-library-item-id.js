/**
 * Migration: Add library_item_id to wardrobe table
 * Links wardrobe items to the wardrobe_library system
 */

exports.up = (pgm) => {
  // Add library_item_id column to wardrobe table
  pgm.addColumn('wardrobe', {
    library_item_id: {
      type: 'integer',
      references: 'wardrobe_library',
      onDelete: 'SET NULL',
    },
  });

  // Add index for performance
  pgm.createIndex('wardrobe', 'library_item_id', {
    name: 'idx_wardrobe_library_item_id',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('wardrobe', 'library_item_id', {
    name: 'idx_wardrobe_library_item_id',
  });
  pgm.dropColumn('wardrobe', 'library_item_id');
};
