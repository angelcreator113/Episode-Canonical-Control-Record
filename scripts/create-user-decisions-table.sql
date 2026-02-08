-- Create user_decisions table for Decision Analytics
CREATE TABLE IF NOT EXISTS user_decisions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
  decision_type VARCHAR(100) NOT NULL,
  chosen_value TEXT NOT NULL,
  available_options JSONB,
  context JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_decisions_user_id ON user_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_decisions_episode_id ON user_decisions(episode_id);
CREATE INDEX IF NOT EXISTS idx_user_decisions_type ON user_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_user_decisions_created_at ON user_decisions(created_at);

-- Add comment
COMMENT ON TABLE user_decisions IS 'Tracks user editing decisions for AI training and analytics';

SELECT 'User decisions table created successfully!' AS status;
