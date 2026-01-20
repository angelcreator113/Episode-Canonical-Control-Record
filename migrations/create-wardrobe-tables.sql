-- ============================================================================
-- WARDROBE SYSTEM MIGRATION
-- ============================================================================
-- This migration creates the wardrobe and episode_wardrobe tables
-- Separates wardrobe functionality from the assets table
-- Run this migration to enable the new wardrobe system

-- ============================================================================
-- 1. CREATE WARDROBE TABLE
-- ============================================================================
-- Stores clothing and fashion items worn by characters

CREATE TABLE IF NOT EXISTS wardrobe (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core fields
  name VARCHAR(255) NOT NULL,
  character VARCHAR(50) NOT NULL,
  clothing_category VARCHAR(50) NOT NULL,
  
  -- Image storage
  s3_key VARCHAR(500),
  s3_url TEXT,
  thumbnail_url TEXT,
  
  -- Detailed metadata
  brand VARCHAR(255),
  price DECIMAL(10, 2),
  purchase_link TEXT,
  website VARCHAR(500),
  color VARCHAR(100),
  size VARCHAR(50),
  season VARCHAR(50),
  occasion VARCHAR(100),
  
  -- Outfit tracking
  outfit_set_id VARCHAR(100),
  outfit_set_name VARCHAR(255),
  scene_description TEXT,
  outfit_notes TEXT,
  
  -- Usage tracking
  times_worn INTEGER NOT NULL DEFAULT 0,
  last_worn_date TIMESTAMP WITH TIME ZONE,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Tags (JSON array)
  tags JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT check_times_worn_positive CHECK (times_worn >= 0),
  CONSTRAINT check_price_positive CHECK (price IS NULL OR price >= 0)
);

-- Indexes for wardrobe table
CREATE INDEX idx_wardrobe_character ON wardrobe(character);
CREATE INDEX idx_wardrobe_category ON wardrobe(clothing_category);
CREATE INDEX idx_wardrobe_is_favorite ON wardrobe(is_favorite);
CREATE INDEX idx_wardrobe_deleted_at ON wardrobe(deleted_at);
CREATE INDEX idx_wardrobe_outfit_set ON wardrobe(outfit_set_id);
CREATE INDEX idx_wardrobe_tags ON wardrobe USING GIN(tags);

-- Comment on table
COMMENT ON TABLE wardrobe IS 'Stores clothing and fashion items worn by characters across episodes';
COMMENT ON COLUMN wardrobe.character IS 'Character who wears this: lala, justawoman, guest';
COMMENT ON COLUMN wardrobe.clothing_category IS 'Category: dress, top, bottom, shoes, accessories, jewelry, perfume';
COMMENT ON COLUMN wardrobe.tags IS 'JSON array of tags for filtering and search';

-- ============================================================================
-- 2. CREATE EPISODE_WARDROBE JUNCTION TABLE
-- ============================================================================
-- Links episodes to wardrobe items (many-to-many relationship)

CREATE TABLE IF NOT EXISTS episode_wardrobe (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  wardrobe_id UUID NOT NULL REFERENCES wardrobe(id) ON DELETE CASCADE,
  
  -- Episode-specific metadata
  scene VARCHAR(255),
  worn_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Ensure unique episode-wardrobe combination
  CONSTRAINT unique_episode_wardrobe UNIQUE (episode_id, wardrobe_id)
);

-- Indexes for episode_wardrobe table
CREATE INDEX idx_episode_wardrobe_episode ON episode_wardrobe(episode_id);
CREATE INDEX idx_episode_wardrobe_wardrobe ON episode_wardrobe(wardrobe_id);
CREATE INDEX idx_episode_wardrobe_worn_at ON episode_wardrobe(worn_at);

-- Comment on table
COMMENT ON TABLE episode_wardrobe IS 'Junction table linking episodes to wardrobe items';
COMMENT ON COLUMN episode_wardrobe.scene IS 'Scene where this wardrobe item was worn';
COMMENT ON COLUMN episode_wardrobe.worn_at IS 'Date when this item was worn/linked to the episode';

-- ============================================================================
-- 3. CREATE TRIGGER FUNCTIONS
-- ============================================================================

-- Auto-update updated_at timestamp for wardrobe
CREATE OR REPLACE FUNCTION update_wardrobe_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_wardrobe_updated_at
  BEFORE UPDATE ON wardrobe
  FOR EACH ROW
  EXECUTE FUNCTION update_wardrobe_updated_at();

-- Auto-update updated_at timestamp for episode_wardrobe
CREATE OR REPLACE FUNCTION update_episode_wardrobe_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_episode_wardrobe_updated_at
  BEFORE UPDATE ON episode_wardrobe
  FOR EACH ROW
  EXECUTE FUNCTION update_episode_wardrobe_updated_at();

-- ============================================================================
-- 4. GRANT PERMISSIONS (adjust role name as needed)
-- ============================================================================

-- GRANT ALL PRIVILEGES ON TABLE wardrobe TO your_app_user;
-- GRANT ALL PRIVILEGES ON TABLE episode_wardrobe TO your_app_user;

-- ============================================================================
-- 5. MIGRATION VERIFICATION
-- ============================================================================

-- Verify tables were created
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('wardrobe', 'episode_wardrobe')
ORDER BY table_name;

-- Verify indexes were created
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('wardrobe', 'episode_wardrobe')
ORDER BY tablename, indexname;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- The wardrobe system is now ready to use!
-- 
-- Next steps:
-- 1. Optionally migrate existing CLOTHING_* assets from assets table
-- 2. Update frontend to use new /api/v1/wardrobe endpoints
-- 3. Test wardrobe item creation and linking to episodes
-- ============================================================================
