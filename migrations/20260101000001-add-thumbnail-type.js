/**
 * Migration: Add thumbnail_type column to thumbnails table
 * This migration adds the missing thumbnail_type ENUM column
 */

exports.up = (pgm) => {
  // Create the thumbnail_type ENUM type if it doesn't exist
  pgm.createType('thumbnail_type_enum', ['primary', 'cover', 'poster', 'frame'], { 
    ifNotExists: true 
  });

  // Add the thumbnail_type column to thumbnails table
  pgm.addColumn('thumbnails', {
    thumbnail_type: {
      type: 'thumbnail_type_enum',
      notNull: false,
      default: 'primary',
      comment: 'Type of thumbnail (primary/cover/poster/frame)',
    },
  });

  // Create index on episodeId and thumbnail_type for faster queries
  pgm.createIndex('thumbnails', ['episode_id', 'thumbnail_type'], {
    name: 'idx_thumbnail_type',
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  // Drop the index
  pgm.dropIndex('thumbnails', ['episode_id', 'thumbnail_type'], {
    ifExists: true,
    name: 'idx_thumbnail_type',
  });

  // Remove the thumbnail_type column
  pgm.dropColumn('thumbnails', 'thumbnail_type', { ifExists: true });

  // Drop the ENUM type
  pgm.dropType('thumbnail_type_enum', { ifExists: true });
};
