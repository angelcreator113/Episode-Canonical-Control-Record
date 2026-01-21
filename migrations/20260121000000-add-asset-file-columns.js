/**
 * Migration: Add file_name and content_type columns to assets table
 * Date: 2026-01-21
 * Purpose: Add missing columns needed for proper S3 downloads and asset tracking
 */

exports.up = async (pgm) => {
  // Add file_name column if it doesn't exist
  pgm.addColumn('assets', {
    file_name: {
      type: 'varchar(500)',
      notNull: false,
    },
  }, {
    ifNotExists: true,
  });

  // Add content_type column if it doesn't exist
  pgm.addColumn('assets', {
    content_type: {
      type: 'varchar(100)',
      notNull: false,
    },
  }, {
    ifNotExists: true,
  });

  // Backfill s3_key_raw from s3_url_raw for existing records that are missing it
  pgm.sql(`
    UPDATE assets 
    SET s3_key_raw = SUBSTRING(s3_url_raw FROM 'amazonaws.com/(.*)$')
    WHERE s3_key_raw IS NULL 
      AND s3_url_raw IS NOT NULL 
      AND s3_url_raw LIKE '%amazonaws.com/%'
  `);

  // Add comment to document the columns
  pgm.sql(`
    COMMENT ON COLUMN assets.file_name IS 'Original filename of the uploaded asset';
    COMMENT ON COLUMN assets.content_type IS 'MIME type of the asset (e.g., image/jpeg, video/mp4)';
  `);
};

exports.down = async (pgm) => {
  pgm.dropColumn('assets', 'file_name', { ifExists: true });
  pgm.dropColumn('assets', 'content_type', { ifExists: true });
};
