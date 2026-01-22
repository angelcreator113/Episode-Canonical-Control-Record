-- Create episode_assets junction table
CREATE TABLE IF NOT EXISTS episode_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  usage_context varchar(100),
  display_order integer DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_episode_asset UNIQUE (episode_id, asset_id)
);

CREATE INDEX IF NOT EXISTS episode_assets_episode_id_idx ON episode_assets(episode_id);
CREATE INDEX IF NOT EXISTS episode_assets_asset_id_idx ON episode_assets(asset_id);

-- Fix episode_scripts table ID to UUID
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'episode_scripts' 
    AND column_name = 'id' 
    AND data_type IN ('integer', 'bigint')
  ) THEN
    ALTER TABLE episode_scripts DROP CONSTRAINT IF EXISTS episode_scripts_pkey CASCADE;
    ALTER TABLE episode_scripts ADD COLUMN IF NOT EXISTS new_id uuid DEFAULT gen_random_uuid();
    ALTER TABLE episode_scripts DROP COLUMN id;
    ALTER TABLE episode_scripts RENAME COLUMN new_id TO id;
    ALTER TABLE episode_scripts ALTER COLUMN id SET NOT NULL;
    ALTER TABLE episode_scripts ADD PRIMARY KEY (id);
  END IF;
END $$;
