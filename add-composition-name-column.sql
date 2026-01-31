-- Add missing name column to thumbnail_compositions table
ALTER TABLE thumbnail_compositions 
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Add missing description column if it doesn't exist
ALTER TABLE thumbnail_compositions 
ADD COLUMN IF NOT EXISTS description TEXT;

SELECT 'Migration completed successfully' AS status;
