-- Create wardrobe and episode_wardrobe tables

-- Main wardrobe table
CREATE TABLE IF NOT EXISTS wardrobe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  character VARCHAR(100),
  clothing_category VARCHAR(100),
  description TEXT,
  s3_url TEXT,
  s3_url_processed TEXT,
  thumbnail_url TEXT,
  color VARCHAR(50),
  season VARCHAR(50),
  tags TEXT[],
  notes TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Junction table linking wardrobe items to episodes
CREATE TABLE IF NOT EXISTS episode_wardrobe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  wardrobe_id UUID NOT NULL REFERENCES wardrobe(id) ON DELETE CASCADE,
  scene VARCHAR(255),
  worn_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(episode_id, wardrobe_id)
);

-- Indexes for wardrobe
CREATE INDEX IF NOT EXISTS idx_wardrobe_character ON wardrobe(character);
CREATE INDEX IF NOT EXISTS idx_wardrobe_category ON wardrobe(clothing_category);
CREATE INDEX IF NOT EXISTS idx_wardrobe_deleted ON wardrobe(deleted_at);

-- Indexes for episode_wardrobe
CREATE INDEX IF NOT EXISTS idx_episode_wardrobe_episode_id ON episode_wardrobe(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_wardrobe_wardrobe_id ON episode_wardrobe(wardrobe_id);

-- Comments
COMMENT ON TABLE wardrobe IS 'Wardrobe items used across episodes';
COMMENT ON TABLE episode_wardrobe IS 'Junction table linking episodes to wardrobe items';
