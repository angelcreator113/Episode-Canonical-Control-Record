-- Add missing columns to assets table to match Asset model
ALTER TABLE assets ADD COLUMN IF NOT EXISTS name varchar(255);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_group varchar(100);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purpose text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS allowed_uses text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS s3_url_raw text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS s3_url_processed text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS media_type varchar(50);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS deleted_at timestamp;

-- Create index on deleted_at for soft delete queries
CREATE INDEX IF NOT EXISTS assets_deleted_at_idx ON assets(deleted_at);
