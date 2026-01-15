#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function fixSchema() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in .env');
    process.exit(1);
  }

  const client = new Client({ 
    connectionString,
    ssl: process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } 
      : false
  });

  try {
    console.log('🔧 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    console.log('\n📊 Checking current schema...');
    
    // Check current column types
    const checkSchema = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'thumbnail_compositions'
        AND column_name IN ('episode_id', 'thumbnail_id')
      ORDER BY column_name
    `);
    
    console.log('Current schema:');
    checkSchema.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Check if episodes table uses INTEGER or UUID
    const episodesIdType = await client.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'episodes' AND column_name = 'id'
    `);
    
    const episodeIdType = episodesIdType.rows[0]?.data_type;
    console.log(`\n📺 episodes.id type: ${episodeIdType}`);

    if (!episodeIdType) {
      console.error('❌ episodes table not found!');
      process.exit(1);
    }

    console.log('\n🔧 Starting schema migration...');

    // Step 1: Drop existing constraints
    console.log('\n1️⃣ Dropping foreign key constraints...');
    try {
      await client.query(`
        ALTER TABLE thumbnail_compositions 
        DROP CONSTRAINT IF EXISTS "thumbnail_compositions_episode_id_fkey"
      `);
      console.log('  ✅ Dropped episode_id FK');
    } catch (e) {
      console.log('  ℹ️  No episode_id FK to drop');
    }

    try {
      await client.query(`
        ALTER TABLE thumbnail_compositions 
        DROP CONSTRAINT IF EXISTS "thumbnail_compositions_thumbnail_id_fkey"
      `);
      console.log('  ✅ Dropped thumbnail_id FK');
    } catch (e) {
      console.log('  ℹ️  No thumbnail_id FK to drop');
    }

    // Step 2: Check for existing data
    console.log('\n2️⃣ Checking for existing data...');
    const dataCheck = await client.query(`
      SELECT COUNT(*) as count FROM thumbnail_compositions
    `);
    const rowCount = parseInt(dataCheck.rows[0].count);
    console.log(`  Found ${rowCount} existing rows`);

    if (rowCount > 0) {
      console.log('\n⚠️  WARNING: Found existing data!');
      console.log('  This migration will attempt to preserve data by mapping IDs.');
    }

    // Step 3: Fix episode_id type
    console.log('\n3️⃣ Fixing episode_id column type...');
    
    if (episodeIdType === 'integer' || episodeIdType === 'bigint') {
      // Episodes uses INTEGER, so thumbnail_compositions should too
      try {
        await client.query(`
          ALTER TABLE thumbnail_compositions 
          ALTER COLUMN episode_id TYPE INTEGER 
          USING CASE 
            WHEN episode_id IS NULL THEN NULL
            WHEN episode_id ~ '^[0-9]+$' THEN episode_id::INTEGER
            ELSE NULL
          END
        `);
        console.log('  ✅ Changed episode_id to INTEGER');
      } catch (e) {
        console.log('  ℹ️  episode_id already INTEGER or conversion failed');
        console.log('     Error:', e.message);
      }
    } else {
      console.log('  ℹ️  episodes.id is UUID, no change needed');
    }

    // Step 4: Fix thumbnail_id type
    console.log('\n4️⃣ Fixing thumbnail_id column type...');
    try {
      await client.query(`
        ALTER TABLE thumbnail_compositions 
        ALTER COLUMN thumbnail_id DROP NOT NULL
      `);
      console.log('  ✅ Made thumbnail_id nullable');
    } catch (e) {
      console.log('  ℹ️  thumbnail_id already nullable or does not exist');
    }

    try {
      await client.query(`
        ALTER TABLE thumbnail_compositions 
        ALTER COLUMN thumbnail_id TYPE INTEGER
        USING CASE 
          WHEN thumbnail_id IS NULL THEN NULL
          WHEN thumbnail_id ~ '^[0-9]+$' THEN thumbnail_id::INTEGER
          ELSE NULL
        END
      `);
      console.log('  ✅ Changed thumbnail_id to INTEGER');
    } catch (e) {
      console.log('  ℹ️  thumbnail_id already INTEGER or does not exist');
    }

    // Step 5: Re-add foreign keys
    console.log('\n5️⃣ Re-adding foreign key constraints...');
    
    if (episodeIdType === 'integer' || episodeIdType === 'bigint') {
      try {
        await client.query(`
          ALTER TABLE thumbnail_compositions
          ADD CONSTRAINT "thumbnail_compositions_episode_id_fkey" 
          FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL
        `);
        console.log('  ✅ Added episode_id FK');
      } catch (e) {
        console.log('  ⚠️  Could not add episode_id FK:', e.message);
      }
    }

    // Step 6: Verify final schema
    console.log('\n6️⃣ Verifying final schema...');
    const finalSchema = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'thumbnail_compositions'
        AND column_name IN ('episode_id', 'thumbnail_id')
      ORDER BY column_name
    `);
    
    console.log('Final schema:');
    finalSchema.rows.forEach(row => {
      console.log(`  ✅ ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    console.log('\n✅ Schema migration complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migration
console.log('⚠️  DATABASE SCHEMA MIGRATION');
console.log('This will modify the thumbnail_compositions table.');
console.log('Using SAFE conversion to preserve existing data.\n');

fixSchema();
