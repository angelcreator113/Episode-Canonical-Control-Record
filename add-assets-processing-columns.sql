-- Add missing processing columns to assets table

ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS processing_status VARCHAR(50) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS processing_metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for processing_status for faster queries
CREATE INDEX IF NOT EXISTS idx_assets_processing_status ON assets(processing_status);

SELECT 'Processing columns added to assets table' AS status;
