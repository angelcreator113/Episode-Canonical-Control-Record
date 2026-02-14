-- Fix episodes table schema to match Sequelize models

-- Rename episode_title to title (only if episode_title exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'episodes' AND column_name = 'episode_title') THEN
    ALTER TABLE episodes ALTER COLUMN episode_title DROP NOT NULL;
    ALTER TABLE episodes RENAME COLUMN episode_title TO title;
  END IF;
END $$;

-- Rename plot_summary to description (only if plot_summary exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'episodes' AND column_name = 'plot_summary') THEN
    ALTER TABLE episodes RENAME COLUMN plot_summary TO description;
  END IF;
END $$;

-- Add air_date as date type (it's currently timestamp with time zone)
ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS new_air_date date;

UPDATE episodes
  SET new_air_date = air_date::date
  WHERE air_date IS NOT NULL;

ALTER TABLE episodes
  DROP COLUMN IF EXISTS air_date CASCADE;

ALTER TABLE episodes
  RENAME COLUMN new_air_date TO air_date;

-- Add status column (currently using processing_status)
ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS status varchar(50) DEFAULT 'draft';

-- Add created_at and updated_at  
ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT NOW();

ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT NOW();

-- Set created_at from upload_date if available
UPDATE episodes
  SET created_at = upload_date
  WHERE upload_date IS NOT NULL AND created_at IS NULL;

-- Set updated_at from last_modified if available
UPDATE episodes
  SET updated_at = last_modified
  WHERE last_modified IS NOT NULL AND updated_at IS NULL;

-- Make sure show_id column exists (it already does from our previous SQL)
-- Just make sure it's properly set up
-- ALTER TABLE episodes ADD COLUMN IF NOT EXISTS show_id uuid REFERENCES shows(id) ON DELETE SET NULL;

-- Add categories column (for show management)
ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS categories jsonb DEFAULT '[]';

-- The old columns can be kept for now, or dropped later after data migration
-- DROP COLUMN show_name, season_number, director, writer, duration_minutes, rating, genre,
-- thumbnail_url, poster_url, video_url, raw_video_s3_key, processed_video_s3_key,
-- metadata_json_s3_key, processing_status, upload_date, last_modified;

-- Make title NOT NULL
ALTER TABLE episodes
  ALTER COLUMN title SET NOT NULL;

-- Change id from integer to uuid
-- This is tricky - we'll need to create a new column and migrate data
ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS new_id uuid DEFAULT gen_random_uuid();

-- For now, let's just ensure the important columns match
-- The ID migration would need more careful handling of foreign keys

COMMENT ON TABLE episodes IS 'Updated schema to match Sequelize models - 2026-01-20';
