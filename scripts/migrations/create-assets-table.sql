-- Create assets table
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  asset_type VARCHAR(100),
  approval_status VARCHAR(50) DEFAULT 'APPROVED',
  s3_key_raw VARCHAR(500),
  s3_url_raw VARCHAR(500),
  file_size_bytes INTEGER,
  s3_key_processed VARCHAR(500),
  s3_url_processed VARCHAR(500),
  processed_file_size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  media_type VARCHAR(20) DEFAULT 'image',
  duration_seconds INTEGER,
  video_codec VARCHAR(50),
  audio_codec VARCHAR(50),
  bitrate INTEGER,
  description TEXT,
  processing_job_id VARCHAR(255),
  processing_error TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  s3_key VARCHAR(500),
  url VARCHAR(500),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_approval_status ON assets(approval_status);
CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON assets(deleted_at);
CREATE INDEX IF NOT EXISTS idx_assets_metadata_episode_id ON assets USING gin((metadata->'episodeId'));
