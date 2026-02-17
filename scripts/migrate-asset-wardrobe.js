/**
 * Run Asset Wardrobe System Migration
 * Execute with: node scripts/migrate-asset-wardrobe.js
 */
const { Sequelize } = require('sequelize');
const config = require('../src/config/sequelize.js');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env] || config;

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  port: dbConfig.port,
  dialect: 'postgres',
  logging: false
});

async function run() {
  try {
    console.log('🔧 Running Asset Wardrobe System Migration...\n');

    // 1. Create enums
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE entity_type AS ENUM ('character','creator','prop','environment');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE asset_category AS ENUM (
          'wardrobe_outfit','wardrobe_accessory','wardrobe_shoes',
          'wardrobe_hairstyle','wardrobe_pose','background',
          'ui_element','prop','overlay','music','sfx'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE transformation_stage AS ENUM ('before','during','after','neutral');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log('  ✅ Enums created (entity_type, asset_category, transformation_stage)');

    // 2. Extend assets table with wardrobe/background columns
    const assetColumns = [
      ['entity_type', 'entity_type'],
      ['category', 'asset_category'],
      ['character_name', 'VARCHAR(100)'],
      ['outfit_name', 'VARCHAR(255)'],
      ['outfit_era', 'VARCHAR(100)'],
      ['transformation_stage', 'transformation_stage'],
      ['first_used_episode_id', 'UUID REFERENCES episodes(id)'],
      ['usage_count', 'INTEGER DEFAULT 0'],
      ['color_palette', 'JSONB'],
      ['mood_tags', 'TEXT[]'],
      ['location_name', 'VARCHAR(255)'],
      ['location_version', 'INTEGER'],
      ['introduced_episode_id', 'UUID REFERENCES episodes(id)'],
      ['active_from_episode', 'INTEGER'],
      ['active_to_episode', 'INTEGER']
    ];
    for (const [name, type] of assetColumns) {
      await sequelize.query(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS "${name}" ${type};`);
    }
    console.log('  ✅ Assets table — 15 new columns added');

    // 3. Extend scene_assets with placement columns
    const sceneAssetColumns = [
      ['asset_role', 'VARCHAR(50)'],
      ['character_name', 'VARCHAR(100)'],
      ['position_x', 'INTEGER'],
      ['position_y', 'INTEGER'],
      ['scale', 'DECIMAL(5,2) DEFAULT 1.0'],
      ['z_index', 'INTEGER DEFAULT 0']
    ];
    for (const [name, type] of sceneAssetColumns) {
      await sequelize.query(`ALTER TABLE scene_assets ADD COLUMN IF NOT EXISTS "${name}" ${type};`);
    }
    console.log('  ✅ Scene assets table — 6 new columns added');

    // 4. Create indexes
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_assets_entity_type ON assets(entity_type);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_assets_character ON assets(character_name) WHERE character_name IS NOT NULL;');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location_name, location_version) WHERE location_name IS NOT NULL;');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_assets_show_category ON assets(show_id, category);');
    console.log('  ✅ Indexes created (5 new indexes)');

    // 5. Create episode_wardrobe_defaults table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS episode_wardrobe_defaults (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        character_name VARCHAR(100) NOT NULL,
        default_outfit_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(episode_id, character_name)
      );
    `);
    console.log('  ✅ Table created: episode_wardrobe_defaults');

    // 6. Create asset_usage_log table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS asset_usage_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
        scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
        context VARCHAR(100),
        used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_asset_usage_asset ON asset_usage_log(asset_id);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_asset_usage_episode ON asset_usage_log(episode_id);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_asset_usage_scene ON asset_usage_log(scene_id);');
    console.log('  ✅ Table created: asset_usage_log');

    // Verify
    const [tables] = await sequelize.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('episode_wardrobe_defaults', 'asset_usage_log')
      ORDER BY tablename;
    `);
    console.log(`\n🎉 Migration complete! New tables: ${tables.map(t => t.tablename).join(', ')}`);

    await sequelize.close();
  } catch (e) {
    console.error('\n❌ Migration failed:', e.message);
    await sequelize.close();
    process.exit(1);
  }
}

run();
