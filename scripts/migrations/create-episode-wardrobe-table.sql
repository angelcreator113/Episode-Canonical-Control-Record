-- Create episode_wardrobe junction table
CREATE TABLE IF NOT EXISTS episode_wardrobe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  wardrobe_id uuid NOT NULL REFERENCES wardrobe(id) ON DELETE CASCADE,
  scene varchar(255),
  worn_at timestamp NOT NULL DEFAULT NOW(),
  notes text,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_episode_wardrobe UNIQUE (episode_id, wardrobe_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS episode_wardrobe_episode_id_idx ON episode_wardrobe(episode_id);
CREATE INDEX IF NOT EXISTS episode_wardrobe_wardrobe_id_idx ON episode_wardrobe(wardrobe_id);
