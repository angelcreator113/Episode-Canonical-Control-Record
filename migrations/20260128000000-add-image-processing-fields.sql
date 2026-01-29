-- Migration: Add image processing fields to assets table
-- File: migrations/2026-01-28-add-image-processing-fields.sql
-- Date: 2026-01-28

-- Add new columns for processed image versions
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS s3_url_no_bg TEXT,
ADD COLUMN IF NOT EXISTS s3_url_enhanced TEXT,
ADD COLUMN IF NOT EXISTS processing_status VARCHAR(50) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS processing_metadata JSONB DEFAULT '{}'::jsonb;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_assets_processing_status ON assets(processing_status);

-- Update metadata JSONB to include processing flags
COMMENT ON COLUMN assets.s3_url_no_bg IS 'S3 URL for version with background removed';
COMMENT ON COLUMN assets.s3_url_enhanced IS 'S3 URL for enhanced version (skin smoothing, etc)';
COMMENT ON COLUMN assets.processing_status IS 'Status: none, processing_bg_removal, bg_removed, processing_enhancement, enhanced, failed';
COMMENT ON COLUMN assets.processing_metadata IS 'Processing parameters and results (JSON)';

-- Example processing_metadata structure:
-- {
--   "background_removal": {
--     "provider": "remove.bg",
--     "timestamp": "2026-01-28T12:00:00Z",
--     "status": "completed"
--   },
--   "enhancement": {
--     "provider": "cloudinary",
--     "settings": {
--       "skin_smooth": 50,
--       "saturation": 20,
--       "vibrance": 20,
--       "contrast": 10,
--       "sharpen": 20
--     },
--     "timestamp": "2026-01-28T12:01:00Z",
--     "status": "completed",
--     "cloudinary_public_id": "enhanced/123/abc.jpg"
--   }
-- }
