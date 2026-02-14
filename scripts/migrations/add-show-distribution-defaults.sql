-- Add distribution_defaults column to shows table
ALTER TABLE shows ADD COLUMN IF NOT EXISTS distribution_defaults JSONB;

-- Add comment for documentation
COMMENT ON COLUMN shows.distribution_defaults IS 'Show-level distribution defaults per platform (account credentials, default hashtags, brand guidelines)';
