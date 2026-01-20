-- Create episode_assets junction table
-- Links episodes with their assets and tracks usage type

CREATE TABLE IF NOT EXISTS episode_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  usage_type VARCHAR(50) NOT NULL DEFAULT 'general',
  scene_number INTEGER,
  display_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(episode_id, asset_id, usage_type)
);

CREATE INDEX IF NOT EXISTS idx_episode_assets_episode_id ON episode_assets(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_assets_asset_id ON episode_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_episode_assets_usage_type ON episode_assets(usage_type);

-- Add comment
COMMENT ON TABLE episode_assets IS 'Junction table linking episodes to their assets';
