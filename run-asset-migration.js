/**
 * Script to run the video and labels migration
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'episode_metadata',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  });

  try {
    console.log('🚀 Running video and labels migration...');

    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', 'add-video-and-labels-support.sql'),
      'utf8'
    );

    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('\nChanges applied:');
    console.log('  - Added video fields to assets table');
    console.log('  - Created asset_labels table');
    console.log('  - Created asset_label_mappings table');
    console.log('  - Created asset_usage table');
    console.log('  - Added indexes for performance');
    console.log('  - Pre-populated 9 default labels');

    // Verify tables exist
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('asset_labels', 'asset_label_mappings', 'asset_usage')
    `);

    console.log('\n✓ Verified tables:', result.rows.map(r => r.table_name).join(', '));

    // Show label count
    const labelCount = await pool.query('SELECT COUNT(*) FROM asset_labels');
    console.log(`✓ Labels created: ${labelCount.rows[0].count}`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
