#!/usr/bin/env node
/**
 * Create scene_assets junction table
 * Links scenes with their assets and tracks positioning/timing
 */

require('dotenv').config();
const { Client } = require('pg');

async function createTable() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    database: 'episode_metadata',
    user: 'postgres',
    password: 'Ayanna123',
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!');
    
    console.log('🔄 Creating scene_assets table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS scene_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
        asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        usage_type VARCHAR(50) NOT NULL DEFAULT 'overlay',
        start_timecode VARCHAR(20),
        end_timecode VARCHAR(20),
        layer_order INTEGER DEFAULT 0,
        opacity DECIMAL(3,2) DEFAULT 1.00,
        position JSONB DEFAULT '{"x": 0, "y": 0, "width": "100%", "height": "100%"}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        UNIQUE(scene_id, asset_id, usage_type)
      );
      
      CREATE INDEX IF NOT EXISTS idx_scene_assets_scene_id ON scene_assets(scene_id);
      CREATE INDEX IF NOT EXISTS idx_scene_assets_asset_id ON scene_assets(asset_id);
      CREATE INDEX IF NOT EXISTS idx_scene_assets_usage_type ON scene_assets(usage_type);
      CREATE INDEX IF NOT EXISTS idx_scene_assets_layer_order ON scene_assets(layer_order);
    `);
    
    console.log('✅ Successfully created scene_assets table');
    
    // Add helpful comments
    await client.query(`
      COMMENT ON TABLE scene_assets IS 'Junction table linking scenes to assets with positioning and timing';
      COMMENT ON COLUMN scene_assets.usage_type IS 'How asset is used: overlay, background, promo, watermark';
      COMMENT ON COLUMN scene_assets.start_timecode IS 'When asset appears in scene (HH:MM:SS:FF)';
      COMMENT ON COLUMN scene_assets.end_timecode IS 'When asset disappears from scene (HH:MM:SS:FF)';
      COMMENT ON COLUMN scene_assets.layer_order IS 'Z-index/stacking order (higher = on top)';
      COMMENT ON COLUMN scene_assets.opacity IS 'Asset opacity 0.00-1.00';
      COMMENT ON COLUMN scene_assets.position IS 'Asset position/size: {x, y, width, height}';
    `);
    
    console.log('✅ Added table comments');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

createTable()
  .then(() => {
    console.log('✅ Migration complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
