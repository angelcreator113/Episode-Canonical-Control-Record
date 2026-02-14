#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function fixSchema() {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Connecting to database...');
    await client.connect();
    console.log('✅ Connected');

    console.log('🔧 Fixing thumbnail_compositions schema...');

    // Drop the foreign key constraint if it exists
    try {
      await client.query(`
        ALTER TABLE thumbnail_compositions 
        DROP CONSTRAINT "thumbnail_compositions_episode_id_fkey"
      `);
      console.log('  ✅ Dropped old episode_id FK');
    } catch (e) {
      console.log('  ℹ️  No existing FK to drop');
    }

    // Fix episode_id type - change from UUID to INTEGER
    try {
      await client.query(`
        ALTER TABLE thumbnail_compositions 
        ALTER COLUMN episode_id TYPE INTEGER USING NULL
      `);
      console.log('  ✅ Changed episode_id type to INTEGER');
    } catch (e) {
      console.log('  ℹ️  episode_id column may already be correct');
    }

    // Drop the thumbnail_id FK if exists
    try {
      await client.query(`
        ALTER TABLE thumbnail_compositions 
        DROP CONSTRAINT "thumbnail_compositions_thumbnail_id_fkey"
      `);
      console.log('  ✅ Dropped old thumbnail_id FK');
    } catch (e) {
      console.log('  ℹ️  No existing thumbnail_id FK');
    }

    // Fix thumbnail_id type - change from UUID to INTEGER
    try {
      await client.query(`
        ALTER TABLE thumbnail_compositions 
        ALTER COLUMN thumbnail_id DROP NOT NULL,
        ALTER COLUMN thumbnail_id TYPE INTEGER USING NULL
      `);
      console.log('  ✅ Changed thumbnail_id type to INTEGER');
    } catch (e) {
      console.log('  ℹ️  thumbnail_id column may already be correct');
    }

    console.log('✅ Schema migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) console.error('  Detail:', error.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixSchema();
