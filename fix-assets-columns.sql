-- Add missing columns to assets table
-- These columns are required by AssetService

-- Add asset_role column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'asset_role'
    ) THEN
        ALTER TABLE assets ADD COLUMN asset_role VARCHAR(100);
        CREATE INDEX IF NOT EXISTS idx_assets_asset_role ON assets(asset_role);
        RAISE NOTICE 'Added asset_role column';
    END IF;
END $$;

-- Add asset_group column (LALA, GUEST, SHOW, EPISODE, WARDROBE)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'asset_group'
    ) THEN
        ALTER TABLE assets ADD COLUMN asset_group VARCHAR(50);
        CREATE INDEX IF NOT EXISTS idx_assets_asset_group ON assets(asset_group);
        RAISE NOTICE 'Added asset_group column';
    END IF;
END $$;

-- Add asset_scope column (GLOBAL, EPISODE)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'asset_scope'
    ) THEN
        ALTER TABLE assets ADD COLUMN asset_scope VARCHAR(50);
        CREATE INDEX IF NOT EXISTS idx_assets_asset_scope ON assets(asset_scope);
        RAISE NOTICE 'Added asset_scope column';
    END IF;
END $$;

-- Add show_id column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'show_id'
    ) THEN
        ALTER TABLE assets ADD COLUMN show_id UUID;
        CREATE INDEX IF NOT EXISTS idx_assets_show_id ON assets(show_id);
        RAISE NOTICE 'Added show_id column';
    END IF;
END $$;

-- Add episode_id column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'episode_id'
    ) THEN
        ALTER TABLE assets ADD COLUMN episode_id UUID;
        CREATE INDEX IF NOT EXISTS idx_assets_episode_id ON assets(episode_id);
        RAISE NOTICE 'Added episode_id column';
    END IF;
END $$;

-- Add purpose column (MAIN, ICON, BACKGROUND, OVERLAY)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'purpose'
    ) THEN
        ALTER TABLE assets ADD COLUMN purpose VARCHAR(50);
        RAISE NOTICE 'Added purpose column';
    END IF;
END $$;

-- Add allowed_uses column (JSON array)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'allowed_uses'
    ) THEN
        ALTER TABLE assets ADD COLUMN allowed_uses JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added allowed_uses column';
    END IF;
END $$;

-- Add is_global column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'is_global'
    ) THEN
        ALTER TABLE assets ADD COLUMN is_global BOOLEAN DEFAULT false;
        CREATE INDEX IF NOT EXISTS idx_assets_is_global ON assets(is_global);
        RAISE NOTICE 'Added is_global column';
    END IF;
END $$;

-- Add file_name column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'file_name'
    ) THEN
        ALTER TABLE assets ADD COLUMN file_name VARCHAR(255);
        RAISE NOTICE 'Added file_name column';
    END IF;
END $$;

-- Add content_type column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'content_type'
    ) THEN
        ALTER TABLE assets ADD COLUMN content_type VARCHAR(100);
        RAISE NOTICE 'Added content_type column';
    END IF;
END $$;

-- Verify columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'assets' 
ORDER BY ordinal_position;
