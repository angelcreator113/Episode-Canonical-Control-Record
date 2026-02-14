-- Add all missing columns to thumbnail_compositions table
-- Run this migration to update the production database schema

-- Basic info columns
ALTER TABLE thumbnail_compositions 
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS description TEXT;

-- Asset tracking columns
ALTER TABLE thumbnail_compositions 
ADD COLUMN IF NOT EXISTS background_frame_asset_id UUID,
ADD COLUMN IF NOT EXISTS lala_asset_id UUID,
ADD COLUMN IF NOT EXISTS guest_asset_id UUID,
ADD COLUMN IF NOT EXISTS justawomen_asset_id UUID;

-- Configuration columns
ALTER TABLE thumbnail_compositions 
ADD COLUMN IF NOT EXISTS selected_formats JSONB DEFAULT '[]'::jsonb;

-- Status columns
ALTER TABLE thumbnail_compositions 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';

-- Versioning columns
ALTER TABLE thumbnail_compositions 
ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS version_history JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(100),
ADD COLUMN IF NOT EXISTS modification_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Template tracking
ALTER TABLE thumbnail_compositions 
ADD COLUMN IF NOT EXISTS template_version VARCHAR(20);

-- Generation tracking
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_thumbnail_compositions_generation_status') THEN
        CREATE TYPE enum_thumbnail_compositions_generation_status AS ENUM ('DRAFT', 'GENERATING', 'COMPLETED', 'FAILED');
    END IF;
END $$;

ALTER TABLE thumbnail_compositions 
ADD COLUMN IF NOT EXISTS generation_status enum_thumbnail_compositions_generation_status DEFAULT 'DRAFT',
ADD COLUMN IF NOT EXISTS validation_errors JSONB,
ADD COLUMN IF NOT EXISTS validation_warnings JSONB,
ADD COLUMN IF NOT EXISTS generated_formats JSONB;

-- Audit columns
ALTER TABLE thumbnail_compositions 
ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);

SELECT 'All missing columns added successfully' AS status;
