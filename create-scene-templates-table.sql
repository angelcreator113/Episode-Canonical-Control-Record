-- Create scene_templates table if it doesn't exist
-- This provides reusable scene templates for quick scene creation

CREATE TABLE IF NOT EXISTS scene_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  scene_type VARCHAR(50) DEFAULT 'main',
  mood VARCHAR(50),
  location VARCHAR(255),
  duration_seconds INTEGER,
  structure JSONB DEFAULT '{}',
  default_settings JSONB DEFAULT '{}',
  created_by UUID,
  is_public BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scene_templates_created_by ON scene_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_scene_templates_is_public ON scene_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_scene_templates_scene_type ON scene_templates(scene_type);

-- Insert default templates (only if table is empty)
INSERT INTO scene_templates (name, description, scene_type, mood, structure, is_public)
SELECT * FROM (VALUES
  (
    'Standard Interview',
    'Basic interview setup with intro and outro',
    'main',
    'neutral',
    '{"sections": ["intro", "questions", "conclusion"], "duration_per_section": [30, 300, 30]}'::jsonb,
    true
  ),
  (
    'Product Review',
    'Product showcase and demonstration',
    'main',
    'upbeat',
    '{"sections": ["unboxing", "features", "demo", "verdict"], "duration_per_section": [60, 120, 180, 60]}'::jsonb,
    true
  ),
  (
    'Tutorial Scene',
    'Step-by-step instructional scene',
    'main',
    'serious',
    '{"sections": ["intro", "step_1", "step_2", "step_3", "recap"], "duration_per_section": [30, 120, 120, 120, 30]}'::jsonb,
    true
  ),
  (
    'Vlog Opening',
    'Engaging intro for vlogs',
    'intro',
    'upbeat',
    '{"elements": ["hook", "greeting", "topic_intro"], "style": "energetic"}'::jsonb,
    true
  )
) AS v(name, description, scene_type, mood, structure, is_public)
WHERE NOT EXISTS (SELECT 1 FROM scene_templates);

-- Add column comments
COMMENT ON TABLE scene_templates IS 'Reusable scene templates with predefined structure and settings';
COMMENT ON COLUMN scene_templates.structure IS 'JSON defining scene sections, timing, and flow';
COMMENT ON COLUMN scene_templates.default_settings IS 'Default values for scene properties when using this template';
COMMENT ON COLUMN scene_templates.is_public IS 'Whether template is available to all users';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'scene_templates table created successfully with default templates';
END $$;
