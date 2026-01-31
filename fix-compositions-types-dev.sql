-- Fix data type mismatches in thumbnail_compositions table (DEV environment)
-- WARNING: This will clear all data in the table

-- Step 1: Backup existing data count
DO $$ 
DECLARE
    row_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO row_count FROM thumbnail_compositions;
    RAISE NOTICE 'Backing up % rows of data', row_count;
END $$;

-- Step 2: Clear the table (dev environment only!)
TRUNCATE TABLE thumbnail_compositions CASCADE;

-- Step 3: Fix episode_id type (INTEGER -> UUID)
ALTER TABLE thumbnail_compositions 
    ALTER COLUMN episode_id TYPE UUID USING NULL;

-- Set it as NOT NULL after type change
ALTER TABLE thumbnail_compositions 
    ALTER COLUMN episode_id SET NOT NULL;

-- Step 4: Fix template_id type (VARCHAR -> UUID)
ALTER TABLE thumbnail_compositions 
    ALTER COLUMN template_id TYPE UUID USING NULL;

-- Step 5: Remove old integer column that doesn't match the model
ALTER TABLE thumbnail_compositions 
    DROP COLUMN IF EXISTS thumbnail_id;

SELECT 'Column types fixed successfully. Table was cleared in dev environment.' AS status;
