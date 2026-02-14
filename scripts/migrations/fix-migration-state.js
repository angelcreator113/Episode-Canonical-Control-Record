/**
 * Fix Migration State
 * Marks existing migrations as complete in the pgmigrations table
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const existingMigrations = [
  '20240101000000-create-base-schema',
  '20240101000001-create-file-storage',
  '20260101000001-add-thumbnail-type',
  '20260105000000-add-composition-versioning',
  '20260105000001-add-filtering-indexes',
  '20260116105409-create-scenes-table',
  '20260116105500-add-advanced-scene-fields',
  '20260116105500-create-scene-templates-table',
  '20260118000000-create-shows-table',
  '20260119000000-add-show-id-to-episodes',
  '20260121000000-add-asset-file-columns',
  '20260122000000-create-episode-scripts-table',
  '20260122000001-create-script-edits-table',
  '20260122000002-add-script-fulltext-index',
  '20260122000003-add-search-history',
  '20260123000000-create-wardrobe-library-system',
  '20260123000001-add-library-columns',
  '20260123000002-add-wardrobe-library-item-id',
  '20260123233313-create-scene-library',
  '20260123233314-create-episode-scenes'
];

async function fixMigrationState() {
  const client = await pool.connect();
  
  try {
    console.log('Checking migration state...\n');
    
    // Check if pgmigrations table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'pgmigrations'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Creating pgmigrations table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS pgmigrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          run_on TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
    }
    
    // Add unique constraint if it doesn't exist
    try {
      await client.query(`
        ALTER TABLE pgmigrations ADD CONSTRAINT pgmigrations_name_unique UNIQUE (name);
      `);
      console.log('Added unique constraint to pgmigrations table');
    } catch (err) {
      // Constraint already exists, that's fine
      if (err.code !== '42P07') {
        throw err;
      }
    }
    
    // Check current migrations
    const current = await client.query('SELECT name FROM pgmigrations ORDER BY name');
    console.log(`Currently recorded migrations: ${current.rows.length}`);
    current.rows.forEach(row => console.log(`  - ${row.name}`));
    console.log('');
    
    // Find missing migrations
    const recordedNames = new Set(current.rows.map(r => r.name));
    const missing = existingMigrations.filter(m => !recordedNames.has(m));
    
    if (missing.length === 0) {
      console.log('✅ All existing migrations are already recorded!');
      return;
    }
    
    console.log(`Found ${missing.length} migrations to mark as complete:`);
    missing.forEach(m => console.log(`  - ${m}`));
    console.log('');
    
    // Insert missing migrations
    console.log('Marking migrations as complete...');
    for (const name of missing) {
      try {
        await client.query(
          'INSERT INTO pgmigrations (name, run_on) VALUES ($1, NOW())',
          [name]
        );
        console.log(`  ✓ ${name}`);
      } catch (err) {
        if (err.code === '23505') {
          // Duplicate, already exists
          console.log(`  - ${name} (already exists)`);
        } else {
          throw err;
        }
      }
    }
    
    console.log('\n✅ Migration state fixed!');
    console.log('\nNow you can run: npm run migrate up');
    console.log('This will only run the new migration: 20260125000001-add-asset-role-system.js');
    
  } catch (err) {
    console.error('❌ Error fixing migration state:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

fixMigrationState().catch(console.error);
