-- Add missing columns to thumbnail_compositions table
-- Uses IF NOT EXISTS checks to avoid errors if columns already exist

-- Add justawomaninherprime_asset_id column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'thumbnail_compositions' 
        AND column_name = 'justawomaninherprime_asset_id'
    ) THEN
        ALTER TABLE thumbnail_compositions 
        ADD COLUMN justawomaninherprime_asset_id UUID;
        RAISE NOTICE 'Added justawomaninherprime_asset_id column';
    END IF;
END $$;

-- Add is_primary column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'thumbnail_compositions' 
        AND column_name = 'is_primary'
    ) THEN
        ALTER TABLE thumbnail_compositions 
        ADD COLUMN is_primary BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_primary column';
    END IF;
END $$;

-- Add composition_config column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'thumbnail_compositions' 
        AND column_name = 'composition_config'
    ) THEN
        ALTER TABLE thumbnail_compositions 
        ADD COLUMN composition_config JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Added composition_config column';
    END IF;
END $$;

-- Add deleted_at column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'thumbnail_compositions' 
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE thumbnail_compositions 
        ADD COLUMN deleted_at TIMESTAMP;
        RAISE NOTICE 'Added deleted_at column';
    END IF;
END $$;

-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'thumbnail_compositions' 
ORDER BY ordinal_position;
