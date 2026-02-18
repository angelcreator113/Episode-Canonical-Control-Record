/**
 * Fix missing columns on dev RDS database
 * 
 * Fixes three 500 errors:
 * 1. GET /api/v1/assets → missing wardrobe-system columns on assets table
 * 2. GET /api/footage/episodes/:id/assets → episode_assets missing deleted_at
 * 3. GET /api/v1/shows/:id/wardrobe → wardrobe table missing show_id
 */
const { sequelize } = require('../src/models');

(async () => {
  console.log('=== Fixing missing columns on dev DB ===\n');

  // 1. Add missing columns to assets table
  const assetColumns = [
    { name: 'entity_type',           sql: 'VARCHAR(50)' },
    { name: 'category',              sql: 'VARCHAR(50)' },
    { name: 'character_name',        sql: 'VARCHAR(100)' },
    { name: 'outfit_name',           sql: 'VARCHAR(255)' },
    { name: 'outfit_era',            sql: 'VARCHAR(100)' },
    { name: 'transformation_stage',  sql: 'VARCHAR(50)' },
    { name: 'first_used_episode_id', sql: 'UUID' },
    { name: 'usage_count',           sql: 'INTEGER DEFAULT 0' },
    { name: 'color_palette',         sql: 'JSONB' },
    { name: 'mood_tags',             sql: 'TEXT[]' },
    { name: 'location_name',         sql: 'VARCHAR(255)' },
    { name: 'location_version',      sql: 'INTEGER' },
    { name: 'introduced_episode_id', sql: 'UUID' },
    { name: 'active_from_episode',   sql: 'INTEGER' },
    { name: 'active_to_episode',     sql: 'INTEGER' },
  ];

  console.log('1) Adding missing columns to assets table...');
  for (const col of assetColumns) {
    try {
      await sequelize.query(
        `ALTER TABLE assets ADD COLUMN IF NOT EXISTS "${col.name}" ${col.sql};`
      );
      console.log(`   ✅ assets.${col.name}`);
    } catch (e) {
      console.log(`   ⚠️  assets.${col.name}: ${e.message}`);
    }
  }

  // 2. Add deleted_at to episode_assets (Sequelize paranoid propagation)
  console.log('\n2) Adding deleted_at to episode_assets...');
  try {
    await sequelize.query(
      `ALTER TABLE episode_assets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;`
    );
    console.log('   ✅ episode_assets.deleted_at');
  } catch (e) {
    console.log(`   ⚠️  episode_assets.deleted_at: ${e.message}`);
  }

  // 3. Add show_id to wardrobe table
  console.log('\n3) Adding show_id to wardrobe table...');
  try {
    await sequelize.query(
      `ALTER TABLE wardrobe ADD COLUMN IF NOT EXISTS show_id UUID REFERENCES shows(id) ON DELETE SET NULL;`
    );
    console.log('   ✅ wardrobe.show_id');
  } catch (e) {
    console.log(`   ⚠️  wardrobe.show_id: ${e.message}`);
  }

  // 4. Add indexes for the new columns
  console.log('\n4) Adding indexes...');
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_assets_entity_type ON assets(entity_type)',
    'CREATE INDEX IF NOT EXISTS idx_assets_character ON assets(character_name) WHERE character_name IS NOT NULL',
    'CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category) WHERE category IS NOT NULL',
    'CREATE INDEX IF NOT EXISTS idx_assets_show_category ON assets(show_id, category)',
    'CREATE INDEX IF NOT EXISTS idx_wardrobe_show_id ON wardrobe(show_id)',
  ];
  for (const idx of indexes) {
    try {
      await sequelize.query(idx);
      console.log(`   ✅ ${idx.match(/idx_\w+/)[0]}`);
    } catch (e) {
      console.log(`   ⚠️  ${e.message}`);
    }
  }

  // 5. Register migration as run (so CI/CD doesn't re-run it)
  console.log('\n5) Registering migration in SequelizeMeta...');
  try {
    await sequelize.query(
      `INSERT INTO "SequelizeMeta" (name) VALUES ('20260216000001-asset-wardrobe-system.js') ON CONFLICT DO NOTHING;`
    );
    console.log('   ✅ Registered 20260216000001-asset-wardrobe-system.js');
  } catch (e) {
    console.log(`   ⚠️  ${e.message}`);
  }

  console.log('\n=== Done! ===');
  process.exit(0);
})().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
