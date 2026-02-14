-- Add deleted_at column to composition_assets table for soft deletes
ALTER TABLE composition_assets 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_composition_assets_deleted_at ON composition_assets(deleted_at);

SELECT 'deleted_at column added to composition_assets' AS status;
