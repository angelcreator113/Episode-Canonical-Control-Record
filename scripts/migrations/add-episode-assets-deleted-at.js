#!/usr/bin/env node
/**
 * Add deleted_at column to episode_assets table for soft deletes
 */

require('dotenv').config();
const { Client } = require('pg');

async function addColumn() {
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
    
    console.log('🔄 Adding deleted_at column to episode_assets...');
    
    await client.query(`
      ALTER TABLE episode_assets 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
    `);
    
    console.log('✅ Successfully added deleted_at column to episode_assets table');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

addColumn()
  .then(() => {
    console.log('✅ Migration complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
