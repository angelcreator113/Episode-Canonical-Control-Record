#!/usr/bin/env node
/**
 * Add icon and color columns to shows table for UI - Direct SQL approach
 */

require('dotenv').config();
const { Client } = require('pg');

async function addColumns() {
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
    
    console.log('🔄 Adding icon and color columns to shows table...');
    
    await client.query(`
      ALTER TABLE shows 
      ADD COLUMN IF NOT EXISTS icon VARCHAR(10) DEFAULT '📺',
      ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#667eea';
    `);
    
    console.log('✅ Added icon and color columns!');
    
    // Verify the columns exist
    const result = await client.query(`
      SELECT column_name, data_type, character_maximum_length, column_default
      FROM information_schema.columns
      WHERE table_name = 'shows' AND column_name IN ('icon', 'color')
      ORDER BY column_name;
    `);
    
    console.log('\n📋 Shows table UI columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}(${row.character_maximum_length}) DEFAULT ${row.column_default}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

addColumns()
  .then(() => {
    console.log('\n✅ Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  });
