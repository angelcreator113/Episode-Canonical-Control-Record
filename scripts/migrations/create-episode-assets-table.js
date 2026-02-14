#!/usr/bin/env node
/**
 * Create episode_assets junction table
 * Links episodes with their assets and tracks usage type
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
    
    console.log('🔄 Creating episode_assets table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS episode_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        usage_type VARCHAR(50) NOT NULL DEFAULT 'general',
        scene_number INTEGER,
        display_order INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(episode_id, asset_id, usage_type)
      );
      
      CREATE INDEX IF NOT EXISTS idx_episode_assets_episode_id ON episode_assets(episode_id);
      CREATE INDEX IF NOT EXISTS idx_episode_assets_asset_id ON episode_assets(asset_id);
      CREATE INDEX IF NOT EXISTS idx_episode_assets_usage_type ON episode_assets(usage_type);
    `);
    
    console.log('✅ Created episode_assets table with indexes!');
    
    // Verify the table
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'episode_assets'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Episode Assets table schema:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}${row.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

createTable()
  .then(() => {
    console.log('\n✅ Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  });
