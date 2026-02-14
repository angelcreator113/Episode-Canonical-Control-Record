-- Create scenes table if it doesn't exist
-- This ensures the table is created even if migrations haven't run yet

CREATE TABLE IF NOT EXISTS scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  title VARCHAR(255),
  description TEXT,
  duration_seconds INTEGER,
  location VARCHAR(255),
  scene_type VARCHAR(50) DEFAULT 'main',
  production_status VARCHAR(50) DEFAULT 'draft',
  mood VARCHAR(50),
  script_notes TEXT,
  start_timecode VARCHAR(20),
  end_timecode VARCHAR(20),
  characters JSONB DEFAULT '[]',
  thumbnail_id UUID,
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMP,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scenes_episode_id ON scenes(episode_id);
CREATE INDEX IF NOT EXISTS idx_scenes_production_status ON scenes(production_status);
CREATE INDEX IF NOT EXISTS idx_scenes_scene_type ON scenes(scene_type);

-- Create unique constraint for episode_id + scene_number (only for non-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS idx_scenes_episode_scene_number 
  ON scenes (episode_id, scene_number) 
  WHERE deleted_at IS NULL;

-- Add column comments
COMMENT ON TABLE scenes IS 'Individual scenes within episodes';
COMMENT ON COLUMN scenes.scene_number IS 'Sequential scene number within the episode';
COMMENT ON COLUMN scenes.production_status IS 'Status: draft, approved, in_production, completed';
COMMENT ON COLUMN scenes.is_locked IS 'Whether scene can be edited (episode frozen state)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'scenes table created successfully';
END $$;
