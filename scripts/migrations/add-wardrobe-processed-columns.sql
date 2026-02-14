-- Add columns for background-removed processed images
ALTER TABLE wardrobe 
ADD COLUMN IF NOT EXISTS s3_key_processed VARCHAR(500),
ADD COLUMN IF NOT EXISTS s3_url_processed TEXT;

-- Add comment
COMMENT ON COLUMN wardrobe.s3_key_processed IS 'S3 key for background-removed image';
COMMENT ON COLUMN wardrobe.s3_url_processed IS 'Full S3 URL for background-removed image';
