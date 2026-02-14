-- Video Compositions Table
CREATE TABLE IF NOT EXISTS video_compositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'complete', 'error')),
  scenes JSONB DEFAULT '[]'::jsonb,
  assets JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_video_compositions_episode_id ON video_compositions(episode_id);
CREATE INDEX IF NOT EXISTS idx_video_compositions_status ON video_compositions(status);
