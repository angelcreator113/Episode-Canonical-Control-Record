-- Migration: Add Distribution and Content Metadata to Episodes
-- Created: 2026-02-04
-- Purpose: Support enhanced Create Episode form with platform distribution and content planning

-- Add distribution & platform columns
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS platforms JSONB DEFAULT '{}'::jsonb;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS platforms_other VARCHAR(255);
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS content_strategy VARCHAR(50) DEFAULT 'same-everywhere';
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS platform_descriptions JSONB DEFAULT '{}'::jsonb;

-- Add content intent columns
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS content_types JSONB DEFAULT '{}'::jsonb;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS primary_audience TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS tones JSONB DEFAULT '{}'::jsonb;

-- Add structure hints
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS structure JSONB DEFAULT '{}'::jsonb;

-- Add visual requirements
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS visual_requirements JSONB DEFAULT '{}'::jsonb;

-- Add ownership & collaboration
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS owner_creator VARCHAR(255);
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS needs_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS collaborators TEXT;

-- Add indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_episodes_platforms ON episodes USING GIN (platforms);
CREATE INDEX IF NOT EXISTS idx_episodes_content_strategy ON episodes(content_strategy);
CREATE INDEX IF NOT EXISTS idx_episodes_content_types ON episodes USING GIN (content_types);
CREATE INDEX IF NOT EXISTS idx_episodes_needs_approval ON episodes(needs_approval) WHERE needs_approval = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN episodes.platforms IS 'JSONB object tracking which platforms this episode targets (youtube, tiktok, instagram, etc.)';
COMMENT ON COLUMN episodes.platforms_other IS 'Free-text field for platforms not in the standard list';
COMMENT ON COLUMN episodes.content_strategy IS 'Distribution strategy: same-everywhere, same-visuals-diff-captions, or fully-customized';
COMMENT ON COLUMN episodes.platform_descriptions IS 'JSONB object with platform-specific descriptions, hashtags, and CTAs';
COMMENT ON COLUMN episodes.content_types IS 'JSONB object indicating content type (trailer, main show, credits, etc.)';
COMMENT ON COLUMN episodes.primary_audience IS 'Target audience description';
COMMENT ON COLUMN episodes.tones IS 'JSONB object tracking tone attributes (playful, educational, dramatic, etc.)';
COMMENT ON COLUMN episodes.structure IS 'JSONB object indicating structural elements (hasIntro, hasOutro, hasCTA, etc.)';
COMMENT ON COLUMN episodes.visual_requirements IS 'JSONB object tracking visual constraints (brandSafeColors, mustIncludeLogo, etc.)';
COMMENT ON COLUMN episodes.owner_creator IS 'Person responsible for this episode';
COMMENT ON COLUMN episodes.needs_approval IS 'Whether this episode requires approval before publishing';
COMMENT ON COLUMN episodes.collaborators IS 'Comma-separated list of collaborators';
