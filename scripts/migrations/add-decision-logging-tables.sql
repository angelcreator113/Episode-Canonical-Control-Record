-- Create user_decisions table
CREATE TABLE IF NOT EXISTS user_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  
  -- Decision Details
  decision_type VARCHAR(100) NOT NULL,
  decision_category VARCHAR(50) NOT NULL,
  
  -- What was chosen
  chosen_option JSONB NOT NULL,
  
  -- What was rejected (if applicable)
  rejected_options JSONB,
  
  -- AI involvement
  was_ai_suggestion BOOLEAN DEFAULT false,
  ai_confidence_score DECIMAL(3,2),
  
  -- User feedback
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  user_notes TEXT,
  
  -- Metadata
  context_data JSONB,
  timestamp TIMESTAMP DEFAULT NOW(),
  
  -- Tracking
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255)
);

-- Indexes for user_decisions
CREATE INDEX IF NOT EXISTS idx_user_decisions_episode ON user_decisions(episode_id);
CREATE INDEX IF NOT EXISTS idx_user_decisions_scene ON user_decisions(scene_id);
CREATE INDEX IF NOT EXISTS idx_user_decisions_type ON user_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_user_decisions_category ON user_decisions(decision_category);
CREATE INDEX IF NOT EXISTS idx_user_decisions_timestamp ON user_decisions(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_decisions_ai_suggestion ON user_decisions(was_ai_suggestion);

-- GIN indexes for JSONB queries
CREATE INDEX IF NOT EXISTS idx_user_decisions_chosen_option ON user_decisions USING GIN(chosen_option);
CREATE INDEX IF NOT EXISTS idx_user_decisions_context_data ON user_decisions USING GIN(context_data);

-- Create decision_patterns table
CREATE TABLE IF NOT EXISTS decision_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Pattern identification
  pattern_type VARCHAR(100) NOT NULL,
  pattern_category VARCHAR(50) NOT NULL,
  
  -- Pattern data
  pattern_data JSONB NOT NULL,
  
  -- Statistics
  sample_count INTEGER NOT NULL DEFAULT 0,
  confidence_score DECIMAL(3,2) NOT NULL,
  
  -- Time-based evolution
  last_updated TIMESTAMP DEFAULT NOW(),
  first_detected TIMESTAMP DEFAULT NOW(),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for decision_patterns
CREATE INDEX IF NOT EXISTS idx_decision_patterns_type ON decision_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_decision_patterns_category ON decision_patterns(pattern_category);
CREATE INDEX IF NOT EXISTS idx_decision_patterns_confidence ON decision_patterns(confidence_score);
CREATE INDEX IF NOT EXISTS idx_decision_patterns_sample_count ON decision_patterns(sample_count);
