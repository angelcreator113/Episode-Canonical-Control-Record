/**
 * Migration: Add show_id to episodes table
 * Adds foreign key relationship between episodes and shows
 */

exports.up = (pgm) => {
  pgm.addColumn('episodes', {
    show_id: {
      type: 'uuid',
      references: 'shows',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
  });

  // Add index for better query performance
  pgm.createIndex('episodes', 'show_id', {
    name: 'idx_episodes_show_id',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('episodes', 'show_id', {
    name: 'idx_episodes_show_id',
  });
  pgm.dropColumn('episodes', 'show_id');
};
