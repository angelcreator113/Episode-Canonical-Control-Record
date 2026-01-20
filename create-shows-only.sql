-- Create show_status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE show_status_enum AS ENUM ('active', 'paused', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create shows table if it doesn't exist
CREATE TABLE IF NOT EXISTS shows (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title varchar(255) NOT NULL,
  description text,
  status show_status_enum DEFAULT 'active',
  start_date date,
  end_date date,
  metadata jsonb,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW(),
  deleted_at timestamp
);

-- Create index on shows id
CREATE INDEX IF NOT EXISTS shows_id_index ON shows (id);

-- Add show_id column to episodes if it doesn't exist
DO $$ BEGIN
    ALTER TABLE episodes ADD COLUMN show_id uuid REFERENCES shows(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Create index on show_id
CREATE INDEX IF NOT EXISTS episodes_show_id_index ON episodes (show_id);
