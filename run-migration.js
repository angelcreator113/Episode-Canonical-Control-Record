/**
 * Run Image Processing Migration
 * Adds new columns to assets table for background removal and enhancement
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'episode_metadata'
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!');

    console.log('\n📄 Reading migration file...');
    const migrationPath = path.join(__dirname, 'migrations', '2026-01-28-add-image-processing-fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Running migration...');
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the columns were added
    console.log('\n🔍 Verifying new columns...');
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'assets' 
        AND column_name IN ('s3_url_no_bg', 's3_url_enhanced', 'processing_status', 'processing_metadata')
      ORDER BY column_name;
    `);
    
    if (result.rows.length === 4) {
      console.log('✅ All 4 columns verified:');
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.warn('⚠️  Expected 4 columns, found:', result.rows.length);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    // Check if columns already exist
    if (error.message.includes('already exists')) {
      console.log('\n💡 Columns may already exist. Checking...');
      try {
        const checkResult = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'assets' 
            AND column_name IN ('s3_url_no_bg', 's3_url_enhanced', 'processing_status', 'processing_metadata');
        `);
        console.log('✅ Found existing columns:', checkResult.rows.map(r => r.column_name).join(', '));
        console.log('✅ Migration already applied - you\'re good to go!');
      } catch (checkErr) {
        console.error('❌ Error checking columns:', checkErr.message);
      }
    }
    
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n👋 Database connection closed');
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
