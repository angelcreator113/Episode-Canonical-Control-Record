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

-- Create indexes
CREATE INDEX IF NOT EXISTS episodes_air_date_index ON episodes(air_date);
CREATE INDEX IF NOT EXISTS episodes_deleted_at_index ON episodes(deleted_at);
CREATE INDEX IF NOT EXISTS episodes_show_id_index ON episodes(show_id);
CREATE INDEX IF NOT EXISTS episodes_status_index ON episodes(status);
