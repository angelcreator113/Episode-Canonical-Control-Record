CREATE TABLE IF NOT EXISTS metadata_storage (
  id SERIAL PRIMARY KEY,
  episode_id UUID NOT NULL REFERENCES episodes(id),
  extracted_text TEXT,
  scenes_detected JSON,
  sentiment_analysis JSON,
  visual_objects JSON,
  transcription TEXT,
  tags JSON,
  categories JSON,
  thumbnail_descriptions JSON,
  generated_summary TEXT,
  ml_confidence DECIMAL(3,2),
  last_updated_by VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  extraction_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processing_duration_seconds INTEGER
);
