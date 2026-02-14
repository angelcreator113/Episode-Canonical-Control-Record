-- Add scene_id column to episode_wardrobe table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'episode_wardrobe' AND column_name = 'scene_id'
    ) THEN
        ALTER TABLE episode_wardrobe 
        ADD COLUMN scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_episode_wardrobe_scene_id ON episode_wardrobe(scene_id);
        RAISE NOTICE 'Added scene_id column to episode_wardrobe';
    END IF;
END $$;

-- Verify columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'episode_wardrobe' 
ORDER BY ordinal_position;
