-- Add ai_analysis_enabled and last_analyzed_at columns to episode_scripts table
ALTER TABLE episode_scripts 
ADD COLUMN IF NOT EXISTS ai_analysis_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS last_analyzed_at TIMESTAMP;

-- Add index for ai_analysis_enabled
CREATE INDEX IF NOT EXISTS episode_scripts_ai_analysis_enabled_idx ON episode_scripts(ai_analysis_enabled);

-- Verify columns were added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'episode_scripts' 
AND column_name IN ('ai_analysis_enabled', 'last_analyzed_at');
