-- Fix shows table schema to match Sequelize models

-- Rename title to name (if title exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shows' AND column_name = 'title'
  ) THEN
    ALTER TABLE shows RENAME COLUMN title TO name;
  END IF;
END $$;

-- Add name column if it doesn't exist
ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS name varchar(255);

-- Make name NOT NULL and unique
UPDATE shows SET name = COALESCE(name, 'Unnamed Show ' || id::text) WHERE name IS NULL OR name = '';
ALTER TABLE shows
  ALTER COLUMN name SET NOT NULL;

-- Add icon column
ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS icon varchar(500);

-- Add color column
ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS color varchar(50);

-- Add other columns that might be needed by the model
ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS slug varchar(255);

ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS genre varchar(255);

ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS creator_name varchar(255);

ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS network varchar(255);

ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS episode_count integer DEFAULT 0;

ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS season_count integer DEFAULT 1;

ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS premiere_date timestamp with time zone;

ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Update status enum to match model (if needed)
-- The model uses: 'active', 'archived', 'cancelled', 'in_development'
-- But we created it with: 'active', 'paused', 'completed', 'cancelled'
-- Let's update the enum type
DO $$
BEGIN
  -- Drop the old enum and recreate if needed
  ALTER TABLE shows ALTER COLUMN status DROP DEFAULT;
  ALTER TABLE shows ALTER COLUMN status TYPE varchar(50);
  UPDATE shows SET status = 'active' WHERE status NOT IN ('active', 'archived', 'cancelled', 'in_development');
  -- Could recreate as enum but varchar is fine for now
END $$;

-- Create/update indexes
CREATE INDEX IF NOT EXISTS shows_slug_index ON shows (slug);
CREATE INDEX IF NOT EXISTS shows_status_index ON shows (status);
CREATE INDEX IF NOT EXISTS shows_is_active_index ON shows (is_active);
CREATE INDEX IF NOT EXISTS shows_name_index ON shows (name);

-- Generate slugs for existing shows
UPDATE shows 
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

-- Make slug unique
ALTER TABLE shows
  ADD CONSTRAINT shows_slug_unique UNIQUE (slug);

ALTER TABLE shows
  ADD CONSTRAINT shows_name_unique UNIQUE (name);

COMMENT ON TABLE shows IS 'Updated schema to match Sequelize Show model - 2026-01-20';
