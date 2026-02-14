-- Fix episodes table ID column to be UUID instead of INTEGER
-- This is a critical fix for episode creation

DO $$ 
BEGIN
  -- Check if id column is integer type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'episodes' 
    AND column_name = 'id' 
    AND data_type IN ('integer', 'bigint')
  ) THEN
    RAISE NOTICE 'Converting episodes.id from integer to uuid...';
    
    -- Drop existing constraints that depend on id
    ALTER TABLE episodes DROP CONSTRAINT IF EXISTS episodes_pkey CASCADE;
    
    -- Add new uuid id column
    ALTER TABLE episodes ADD COLUMN IF NOT EXISTS new_id uuid DEFAULT gen_random_uuid();
    
    -- Copy any existing data (though there probably isn't any valid data)
    -- UPDATE episodes SET new_id = gen_random_uuid() WHERE new_id IS NULL;
    
    -- Drop old id column
    ALTER TABLE episodes DROP COLUMN id;
    
    -- Rename new_id to id
    ALTER TABLE episodes RENAME COLUMN new_id TO id;
    
    -- Make id NOT NULL
    ALTER TABLE episodes ALTER COLUMN id SET NOT NULL;
    
    -- Make id the primary key
    ALTER TABLE episodes ADD PRIMARY KEY (id);
    
    RAISE NOTICE 'Successfully converted episodes.id to uuid type';
  ELSE
    RAISE NOTICE 'episodes.id is already uuid type, no conversion needed';
  END IF;
END $$;

-- Ensure all other columns match the model
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS episode_number integer;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS title varchar(255);
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS air_date date;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS status varchar(50) DEFAULT 'draft';
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS categories jsonb DEFAULT '[]';
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS show_id uuid REFERENCES shows(id) ON DELETE SET NULL;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT NOW();
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT NOW();
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS deleted_at timestamp;

-- Remove show_name column if it exists (should use show_id foreign key instead)
ALTER TABLE episodes DROP COLUMN IF EXISTS show_name;

-- Remove season_number column if it exists (not in current Episode model)
ALTER TABLE episodes DROP COLUMN IF EXISTS season_number;

-- Create indexes
CREATE INDEX IF NOT EXISTS episodes_air_date_index ON episodes(air_date);
CREATE INDEX IF NOT EXISTS episodes_deleted_at_index ON episodes(deleted_at);
CREATE INDEX IF NOT EXISTS episodes_show_id_index ON episodes(show_id);
CREATE INDEX IF NOT EXISTS episodes_status_index ON episodes(status);

-- Fix episode_wardrobe table to use UUID for episode_id (must match episodes.id type)
DO $$ 
BEGIN
  -- Check if episode_id column is integer type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'episode_wardrobe' 
    AND column_name = 'episode_id' 
    AND data_type IN ('integer', 'bigint')
  ) THEN
    RAISE NOTICE 'Converting episode_wardrobe.episode_id from integer to uuid...';
    
    -- Drop foreign key constraint if it exists
    ALTER TABLE episode_wardrobe DROP CONSTRAINT IF EXISTS episode_wardrobe_episode_id_fkey;
    ALTER TABLE episode_wardrobe DROP CONSTRAINT IF EXISTS fk_episode_wardrobe_episode;
    
    -- Drop the old integer column and add new uuid column
    ALTER TABLE episode_wardrobe DROP COLUMN IF EXISTS episode_id;
    ALTER TABLE episode_wardrobe ADD COLUMN episode_id uuid;
    
    -- Make it NOT NULL and add foreign key
    ALTER TABLE episode_wardrobe ALTER COLUMN episode_id SET NOT NULL;
    ALTER TABLE episode_wardrobe ADD CONSTRAINT episode_wardrobe_episode_id_fkey 
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Successfully converted episode_wardrobe.episode_id to uuid type';
  ELSE
    RAISE NOTICE 'episode_wardrobe.episode_id is already uuid type, no conversion needed';
  END IF;
END $$;
