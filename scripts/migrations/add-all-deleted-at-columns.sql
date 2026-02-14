-- Comprehensive migration to add all missing deleted_at columns
-- This fixes soft delete support across all composition-related tables

-- Add deleted_at to composition_outputs (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'composition_outputs') THEN
        ALTER TABLE composition_outputs 
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
        
        CREATE INDEX IF NOT EXISTS idx_composition_outputs_deleted_at ON composition_outputs(deleted_at);
        RAISE NOTICE 'Added deleted_at to composition_outputs';
    END IF;
END $$;

-- Add deleted_at to outputs (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'outputs') THEN
        ALTER TABLE outputs 
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
        
        CREATE INDEX IF NOT EXISTS idx_outputs_deleted_at ON outputs(deleted_at);
        RAISE NOTICE 'Added deleted_at to outputs';
    END IF;
END $$;

-- Add deleted_at to episode_assets (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'episode_assets') THEN
        ALTER TABLE episode_assets 
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
        
        CREATE INDEX IF NOT EXISTS idx_episode_assets_deleted_at ON episode_assets(deleted_at);
        RAISE NOTICE 'Added deleted_at to episode_assets';
    END IF;
END $$;

-- Add deleted_at to assets (if table exists and column doesn't exist)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assets') THEN
        ALTER TABLE assets 
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
        
        CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON assets(deleted_at);
        RAISE NOTICE 'Added deleted_at to assets';
    END IF;
END $$;

SELECT 'All deleted_at columns added successfully' AS status;
