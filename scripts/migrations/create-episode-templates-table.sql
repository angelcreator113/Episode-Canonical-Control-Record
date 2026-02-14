-- Create episode_templates table if it doesn't exist
-- This provides reusable episode templates with metadata structure

CREATE TABLE IF NOT EXISTS episode_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  structure JSONB DEFAULT '{}',
  default_metadata JSONB DEFAULT '{}',
  thumbnail_url TEXT,
  is_public BOOLEAN DEFAULT false NOT NULL,
  created_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add using camelCase columns for Sequelize compatibility
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP;
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP;
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS "createdBy" VARCHAR(255);
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN;
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS "defaultMetadata" JSONB;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_episode_templates_category ON episode_templates(category);
CREATE INDEX IF NOT EXISTS idx_episode_templates_is_public ON episode_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_episode_templates_created_by ON episode_templates(created_by);

-- Insert default episode templates
INSERT INTO episode_templates (name, description, category, structure, is_public)
SELECT * FROM (VALUES
  (
    'Standard Interview Episode',
    'Basic interview episode with intro, content, and outro',
    'interview',
    '{"sections": ["intro", "main_content", "outro"], "duration": 600}'::jsonb,
    true
  ),
  (
    'Product Review Episode',
    'Comprehensive product review with unboxing, demo, and verdict',
    'review',
    '{"sections": ["intro", "unboxing", "features", "demo", "pros_cons", "verdict"], "duration": 900}'::jsonb,
    true
  ),
  (
    'Tutorial Episode',
    'Step-by-step tutorial format',
    'tutorial',
    '{"sections": ["intro", "prerequisites", "steps", "troubleshooting", "conclusion"], "duration": 1200}'::jsonb,
    true
  )
) AS v(name, description, category, structure, is_public)
WHERE NOT EXISTS (SELECT 1 FROM episode_templates);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'episode_templates table created successfully';
END $$;
