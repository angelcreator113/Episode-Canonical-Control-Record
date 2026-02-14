#!/usr/bin/env node
/**
 * Add deleted_at column to markers table
 * Quick fix for missing soft delete column
 */

const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'episode_metadata',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function addDeletedAtColumn() {
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Check if column exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'markers' 
      AND column_name = 'deleted_at'
    `);

    if (checkResult.rows.length > 0) {
      console.log('ℹ️  deleted_at column already exists, skipping...');
      return;
    }

    console.log('🔄 Adding deleted_at column to markers table...');
    await client.query(`
      ALTER TABLE markers 
      ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    `);
    console.log('✅ deleted_at column added!\n');

    console.log('🔄 Creating index on deleted_at...');
    await client.query(`
      CREATE INDEX idx_markers_deleted_at ON markers(deleted_at);
    `);
    console.log('✅ Index created!\n');

    console.log('🎉 Migration complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

addDeletedAtColumn();
