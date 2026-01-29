-- Create composition_assets junction table
CREATE TABLE IF NOT EXISTS composition_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  composition_id UUID NOT NULL REFERENCES thumbnail_compositions(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  asset_role VARCHAR(50),
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(composition_id, asset_id, asset_role)
);

-- Create composition_outputs table
CREATE TABLE IF NOT EXISTS composition_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  composition_id UUID NOT NULL REFERENCES thumbnail_compositions(id) ON DELETE CASCADE,
  format VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  image_url TEXT,
  s3_key TEXT,
  width INTEGER,
  height INTEGER,
  filesize INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(composition_id, format)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_composition_assets_composition_id ON composition_assets(composition_id);
CREATE INDEX IF NOT EXISTS idx_composition_assets_asset_id ON composition_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_composition_outputs_composition_id ON composition_outputs(composition_id);
CREATE INDEX IF NOT EXISTS idx_composition_outputs_status ON composition_outputs(status);
