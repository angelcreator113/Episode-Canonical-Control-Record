-- Fix data type mismatches in thumbnail_compositions table
-- The model expects UUIDs but the database has integers

-- Step 1: Check if there's any data in the table
DO $$ 
DECLARE
    row_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO row_count FROM thumbnail_compositions;
    RAISE NOTICE 'Table has % rows', row_count;
    
    IF row_count > 0 THEN
        RAISE EXCEPTION 'Table contains data. Manual migration required to preserve data.';
    END IF;
END $$;

-- Step 2: Fix episode_id type (INTEGER -> UUID)
ALTER TABLE thumbnail_compositions 
    DROP COLUMN IF EXISTS episode_id CASCADE,
    ADD COLUMN episode_id UUID NOT NULL;

-- Step 3: Fix template_id type (VARCHAR -> UUID)
ALTER TABLE thumbnail_compositions 
    DROP COLUMN IF EXISTS template_id CASCADE,
    ADD COLUMN template_id UUID;

-- Step 4: Remove old integer columns that don't match the model
ALTER TABLE thumbnail_compositions 
    DROP COLUMN IF EXISTS thumbnail_id;

SELECT 'Column types fixed successfully' AS status;
