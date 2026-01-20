#!/usr/bin/env node
/**
 * Create asset_labels table for tagging/organizing assets
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
    
    console.log('🔄 Creating asset_labels table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS asset_labels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_asset_labels_name ON asset_labels(name);
    `);
    
    console.log('✅ Created asset_labels table!');
    
    console.log('🔄 Creating asset_label_map junction table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS asset_label_map (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        label_id UUID NOT NULL REFERENCES asset_labels(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(asset_id, label_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_asset_label_map_asset ON asset_label_map(asset_id);
      CREATE INDEX IF NOT EXISTS idx_asset_label_map_label ON asset_label_map(label_id);
    `);
    
    console.log('✅ Created asset_label_map table!');
    
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
