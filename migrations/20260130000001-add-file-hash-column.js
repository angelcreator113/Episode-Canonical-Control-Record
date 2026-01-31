/**
 * Migration: Add file_hash column for duplicate detection
 * Adds SHA-256 hash column with unique index to prevent duplicate uploads
 */

exports.up = (pgm) => {
  console.log('📝 Adding file_hash column to assets table...');
  
  // Add file_hash column
  pgm.addColumn('assets', {
    file_hash: {
      type: 'varchar(64)', // SHA-256 produces 64 hex characters
      notNull: false,
      comment: 'SHA-256 hash of file content for duplicate detection',
    }
  });
  
  // Add index for fast duplicate lookups  
  pgm.createIndex('assets', 'file_hash', {
    name: 'idx_assets_file_hash',
    where: 'file_hash IS NOT NULL',
  });
  
  console.log('✅ file_hash column and indexes added successfully');
};

exports.down = (pgm) => {
  console.log('📝 Removing file_hash column and indexes...');
  
  // Remove index
  pgm.dropIndex('assets', 'file_hash', {
    name: 'idx_assets_file_hash',
    ifExists: true,
  });
  
  // Remove column
  pgm.dropColumn('assets', 'file_hash', {
    ifExists: true,
  });
  
  console.log('✅ file_hash column and indexes removed');
};
