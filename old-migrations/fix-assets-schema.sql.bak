-- Fix Assets Table Schema - Add Missing Columns
-- Run this to add all columns that the application expects

BEGIN;

-- Add approval_status column (critical - causing the 500 errors)
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'PENDING';

-- Add raw asset URLs and keys
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS s3_key_raw VARCHAR(500),
ADD COLUMN IF NOT EXISTS s3_url_raw TEXT;

-- Add processed asset URLs and keys (for background removal)
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS s3_key_processed VARCHAR(500),
ADD COLUMN IF NOT EXISTS s3_url_processed TEXT,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS processed_file_size_bytes BIGINT,
ADD COLUMN IF NOT EXISTS processing_job_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS processing_error TEXT;

-- Add file metadata
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
ADD COLUMN IF NOT EXISTS width INTEGER,
ADD COLUMN IF NOT EXISTS height INTEGER,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create index on approval_status for faster queries
CREATE INDEX IF NOT EXISTS idx_assets_approval_status ON assets(approval_status);

-- Create index on asset_type for faster queries
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets(asset_type);

-- Create index on media_type for faster queries
CREATE INDEX IF NOT EXISTS idx_assets_media_type ON assets(media_type);

-- Update existing records to have APPROVED status if they don't have one
UPDATE assets 
SET approval_status = 'APPROVED' 
WHERE approval_status IS NULL;

-- Copy s3_key to s3_key_raw for existing records (backward compatibility)
UPDATE assets 
SET s3_key_raw = s3_key 
WHERE s3_key_raw IS NULL AND s3_key IS NOT NULL;

-- Copy url to s3_url_raw for existing records (backward compatibility)
UPDATE assets 
SET s3_url_raw = url 
WHERE s3_url_raw IS NULL AND url IS NOT NULL;

COMMIT;

-- Display results
SELECT 
  'Assets table updated successfully!' as status,
  COUNT(*) as total_assets,
  COUNT(CASE WHEN approval_status = 'APPROVED' THEN 1 END) as approved_assets,
  COUNT(CASE WHEN media_type = 'video' THEN 1 END) as video_assets,
  COUNT(CASE WHEN media_type = 'image' THEN 1 END) as image_assets
FROM assets;
