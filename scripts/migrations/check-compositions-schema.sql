-- Check and fix the thumbnail_compositions table structure
-- The model expects 'id' as UUID primary key, not 'composition_id' as integer

-- First, let's see what we have
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'thumbnail_compositions' 
ORDER BY ordinal_position;
