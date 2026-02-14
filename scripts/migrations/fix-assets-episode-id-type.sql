-- Fix episode_id column type in assets table
-- It's currently INTEGER but should be UUID

-- Check current type
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'assets' AND column_name = 'episode_id';

-- Change from INTEGER to UUID
ALTER TABLE assets 
    ALTER COLUMN episode_id TYPE UUID USING NULL;

SELECT 'episode_id column type fixed to UUID' AS status;
