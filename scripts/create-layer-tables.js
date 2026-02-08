const { sequelize } = require('../src/models');

async function createLayerTables() {
  try {
    console.log('🏗️  Creating layer management tables...\n');

    // Create layers table
    console.log('Creating layers table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS layers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
        layer_number INTEGER NOT NULL,
        layer_type VARCHAR(50) NOT NULL,
        name VARCHAR(255),
        is_visible BOOLEAN DEFAULT true,
        is_locked BOOLEAN DEFAULT false,
        opacity DECIMAL(3,2) DEFAULT 1.00,
        blend_mode VARCHAR(50) DEFAULT 'normal',
        z_index INTEGER,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_layers_episode ON layers(episode_id);
      CREATE INDEX IF NOT EXISTS idx_layers_deleted ON layers(deleted_at) WHERE deleted_at IS NULL;
    `);
    console.log('✅ layers table created');

    // Create layer_assets table
    console.log('Creating layer_assets table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS layer_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        layer_id UUID REFERENCES layers(id) ON DELETE CASCADE,
        asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
        position_x INTEGER DEFAULT 0,
        position_y INTEGER DEFAULT 0,
        width INTEGER,
        height INTEGER,
        rotation DECIMAL(5,2) DEFAULT 0.00,
        scale_x DECIMAL(3,2) DEFAULT 1.00,
        scale_y DECIMAL(3,2) DEFAULT 1.00,
        opacity DECIMAL(3,2) DEFAULT 1.00,
        start_time DECIMAL(10,3),
        duration DECIMAL(10,3),
        order_index INTEGER,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_layer_assets_layer ON layer_assets(layer_id);
      CREATE INDEX IF NOT EXISTS idx_layer_assets_asset ON layer_assets(asset_id);
      CREATE INDEX IF NOT EXISTS idx_layer_assets_order ON layer_assets(layer_id, order_index);
    `);
    console.log('✅ layer_assets table created');

    // Create layer_presets table
    console.log('Creating layer_presets table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS layer_presets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        preview_image_url TEXT,
        layer_config JSONB NOT NULL,
        is_public BOOLEAN DEFAULT false,
        created_by VARCHAR(255),
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_layer_presets_category ON layer_presets(category);
      CREATE INDEX IF NOT EXISTS idx_layer_presets_deleted ON layer_presets(deleted_at) WHERE deleted_at IS NULL;
    `);
    console.log('✅ layer_presets table created');

    console.log('\n🎉 All layer management tables created successfully!');
    console.log('\nNext steps:');
    console.log('1. Create Sequelize models (Layer, LayerAsset, LayerPreset)');
    console.log('2. Create API routes for CRUD operations');
    console.log('3. Build frontend layer editor UI');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

createLayerTables();
