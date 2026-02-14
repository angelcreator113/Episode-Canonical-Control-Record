const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
  user: 'postgres',
  password: 'Ayanna123!!',
  database: 'episode_metadata',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('✅ Connected\n');

  // Fix scenes table
  console.log('🔧 Adding missing columns to scenes table...');
  const sceneColumns = [
    { name: 'locked_by', type: 'VARCHAR(255)' },
  ];

  for (const col of sceneColumns) {
    try {
      await client.query(`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      console.log(`✅ Added ${col.name}`);
    } catch (e) {
      console.log(`⚠️  ${col.name}: ${e.message}`);
    }
  }

  // Fix episode_templates table  
  console.log('\n🔧 Adding missing columns to episode_templates table...');
  const templateColumns = [
    { name: 'default_status', type: 'VARCHAR(50)', default: "'draft'" },
    { name: 'default_categories', type: 'JSONB', default: "'[]'::jsonb" },
    { name: 'default_duration', type: 'INTEGER' },
    { name: 'config', type: 'JSONB', default: "'{}'::jsonb" },
    { name: 'icon', type: 'VARCHAR(100)', default: "'📺'" },
    { name: 'color', type: 'VARCHAR(50)', default: "'#667eea'" },
    { name: 'sort_order', type: 'INTEGER', default: '0' },
    { name: 'is_active', type: 'BOOLEAN', default: 'true' },
    { name: 'use_count', type: 'INTEGER', default: '0' },
    { name: 'last_used_at', type: 'TIMESTAMP' },
  ];

  for (const col of templateColumns) {
    try {
      let query = `ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`;
      if (col.default) {
        query += ` DEFAULT ${col.default}`;
      }
      await client.query(query);
      console.log(`✅ Added ${col.name}`);
    } catch (e) {
      console.log(`⚠️  ${col.name}: ${e.message}`);
    }
  }

  await client.end();
  console.log('\n✅ All columns added successfully!');
}

main().catch(console.error);
