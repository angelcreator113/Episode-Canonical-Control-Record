-- Create outfit_sets table for managing outfit combinations

CREATE TABLE IF NOT EXISTS outfit_sets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  character VARCHAR(255),
  occasion VARCHAR(100),
  season VARCHAR(50),
  items JSON DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_outfit_sets_character ON outfit_sets(character);
CREATE INDEX IF NOT EXISTS idx_outfit_sets_occasion ON outfit_sets(occasion);
CREATE INDEX IF NOT EXISTS idx_outfit_sets_season ON outfit_sets(season);

-- Add comment
COMMENT ON TABLE outfit_sets IS 'Stores outfit set combinations grouping multiple wardrobe items together';
