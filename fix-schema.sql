-- Add episode_id and template_id fix for Phase 2.5

-- First, check the current schema
-- \d thumbnail_compositions

-- Drop the foreign key constraint if it exists
ALTER TABLE thumbnail_compositions 
DROP CONSTRAINT IF EXISTS "thumbnail_compositions_episode_id_fkey";

-- Alter episode_id to INTEGER
ALTER TABLE thumbnail_compositions 
ALTER COLUMN episode_id TYPE INTEGER USING episode_id::INTEGER;

-- Re-add the foreign key constraint
ALTER TABLE thumbnail_compositions
ADD CONSTRAINT "thumbnail_compositions_episode_id_fkey" 
FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL;

-- Alter thumbnail_id to allow NULL and be INTEGER
ALTER TABLE thumbnail_compositions 
ALTER COLUMN thumbnail_id TYPE INTEGER USING thumbnail_id::INTEGER,
ALTER COLUMN thumbnail_id DROP NOT NULL;

-- Verify the changes
\d thumbnail_compositions
