-- Create thumbnails table
CREATE TABLE IF NOT EXISTS thumbnails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  file_key VARCHAR(500),
  url VARCHAR(1000),
  width_pixels INTEGER,
  height_pixels INTEGER,
  format VARCHAR(50),
  quality_rating VARCHAR(50),
  is_primary BOOLEAN DEFAULT false,
  composition_id UUID,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create processing_queue table
CREATE TABLE IF NOT EXISTS processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  job_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB,
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create metadata_storage table
CREATE TABLE IF NOT EXISTS metadata_storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL,
  value TEXT,
  type VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create thumbnail_compositions table
CREATE TABLE IF NOT EXISTS thumbnail_compositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  name VARCHAR(255),
  description TEXT,
  template_id UUID,
  status VARCHAR(50) DEFAULT 'draft',
  asset_ids JSONB DEFAULT '[]'::jsonb,
  generated_formats JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_thumbnails_episode_id ON thumbnails(episode_id);
CREATE INDEX IF NOT EXISTS idx_thumbnails_primary ON thumbnails(is_primary);
CREATE INDEX IF NOT EXISTS idx_processing_queue_episode_id ON processing_queue(episode_id);
CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_metadata_storage_episode_id ON metadata_storage(episode_id);
CREATE INDEX IF NOT EXISTS idx_compositions_episode_id ON thumbnail_compositions(episode_id);
