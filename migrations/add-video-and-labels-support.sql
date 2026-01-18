-- Migration: Add video support and labels system
-- Date: 2026-01-18
-- Description: Adds video fields to assets, creates labels system

-- Add video and label fields to assets table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) DEFAULT 'image';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS video_codec VARCHAR(50);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS audio_codec VARCHAR(50);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS bitrate INTEGER;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS description TEXT;

-- Create asset_labels table
CREATE TABLE IF NOT EXISTS asset_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(7) DEFAULT '#6366f1',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create junction table for asset-label relationships
CREATE TABLE IF NOT EXISTS asset_label_mappings (
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  label_id UUID REFERENCES asset_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (asset_id, label_id)
);

-- Create asset_usage tracking table
CREATE TABLE IF NOT EXISTS asset_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  used_in_type VARCHAR(50), -- 'composition', 'episode', 'template'
  used_in_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_assets_media_type ON assets(media_type);
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_asset_label_mappings_asset ON asset_label_mappings(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_label_mappings_label ON asset_label_mappings(label_id);
CREATE INDEX IF NOT EXISTS idx_asset_usage_asset ON asset_usage(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_usage_used_in ON asset_usage(used_in_type, used_in_id);

-- Pre-populate common labels
INSERT INTO asset_labels (name, color, description) VALUES
  ('Featured', '#10b981', 'Featured promotional content'),
  ('Archived', '#6b7280', 'Archived assets'),
  ('High Priority', '#ef4444', 'Priority assets'),
  ('Seasonal', '#f59e0b', 'Seasonal content'),
  ('Needs Review', '#8b5cf6', 'Requires review'),
  ('Social Media', '#3b82f6', 'Optimized for social platforms'),
  ('YouTube', '#ef4444', 'YouTube specific content'),
  ('Instagram', '#ec4899', 'Instagram specific content'),
  ('Draft', '#94a3b8', 'Work in progress')
ON CONFLICT (name) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE asset_labels IS 'Labels/tags that can be applied to assets';
COMMENT ON TABLE asset_label_mappings IS 'Many-to-many relationship between assets and labels';
COMMENT ON TABLE asset_usage IS 'Tracks where assets are used in the system';
COMMENT ON COLUMN assets.media_type IS 'Type of media: image or video';
