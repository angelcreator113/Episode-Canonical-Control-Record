-- Add all missing columns to assets table that the model is trying to return

-- Add processed S3 URLs for background removal and enhancement
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS s3_url_no_bg TEXT,
ADD COLUMN IF NOT EXISTS s3_url_enhanced TEXT;

-- Add episode_id for episode-scoped assets
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS episode_id UUID;

-- Add s3_url_processed if it doesn't exist
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS s3_url_processed TEXT;

SELECT 'All missing asset columns added successfully' AS status;
