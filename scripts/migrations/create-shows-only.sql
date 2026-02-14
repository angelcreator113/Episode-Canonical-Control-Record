-- Create show_status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE show_status_enum AS ENUM ('active', 'archived', 'cancelled', 'in_development');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create shows table if it doesn't exist
CREATE TABLE IF NOT EXISTS shows (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name varchar(255) NOT NULL UNIQUE,
  description text,
  slug varchar(255) NOT NULL UNIQUE,
  genre varchar(255),
  status show_status_enum DEFAULT 'active' NOT NULL,
  creator_name varchar(255),
  network varchar(255),
  episode_count integer DEFAULT 0,
  season_count integer DEFAULT 1,
  premiere_date date,
  metadata jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  icon varchar(255),
  color varchar(50),
  created_at timestamp DEFAULT NOW() NOT NULL,
  updated_at timestamp DEFAULT NOW() NOT NULL,
  deleted_at timestamp
);

-- Create indexes on shows
CREATE INDEX IF NOT EXISTS shows_slug_index ON shows (slug);
CREATE INDEX IF NOT EXISTS shows_status_index ON shows (status);
CREATE INDEX IF NOT EXISTS shows_is_active_index ON shows (is_active);
CREATE INDEX IF NOT EXISTS shows_created_at_index ON shows (created_at);

-- Add show_id column to episodes if it doesn't exist
DO $$ BEGIN
    ALTER TABLE episodes ADD COLUMN show_id uuid REFERENCES shows(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Create index on show_id
CREATE INDEX IF NOT EXISTS episodes_show_id_index ON episodes (show_id);
