-- Create scene_libraries table
CREATE TABLE IF NOT EXISTS scene_libraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID NOT NULL,
  video_asset_url TEXT,
  thumbnail_url TEXT,
  title VARCHAR(255),
  description TEXT,
  characters TEXT[],
  tags TEXT[],
  duration_seconds DECIMAL(10, 3),
  resolution VARCHAR(50),
  frame_rate DECIMAL(10, 3),
  codec VARCHAR(100),
  file_size_bytes BIGINT,
  processing_status VARCHAR(50) DEFAULT 'pending',
  upload_progress INTEGER DEFAULT 0,
  metadata JSONB,
  search_vector TSVECTOR,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scene_libraries_show_id ON scene_libraries(show_id);
CREATE INDEX IF NOT EXISTS idx_scene_libraries_processing_status ON scene_libraries(processing_status);
CREATE INDEX IF NOT EXISTS idx_scene_libraries_created_at ON scene_libraries(created_at);
