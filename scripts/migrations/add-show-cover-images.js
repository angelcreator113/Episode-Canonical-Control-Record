#!/usr/bin/env node
/**
 * Add cover image columns to shows table
 * For Netflix-style portrait cover images (2:3 aspect ratio)
 */

require('dotenv').config();
const { Client } = require('pg');

async function addCoverImageColumns() {
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
    
    console.log('🔄 Adding cover image columns to shows table...');
    
    await client.query(`
      ALTER TABLE shows 
      ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
      ADD COLUMN IF NOT EXISTS cover_s3_key VARCHAR(512);
    `);
    
    console.log('✅ Added cover image columns!');
    
    // Verify the columns exist
    const result = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'shows' 
        AND column_name IN ('cover_image_url', 'cover_s3_key', 'icon', 'color')
      ORDER BY column_name;
    `);

    console.log('\n📋 Shows table visual columns:');
    result.rows.forEach(row => {
      const maxLen = row.character_maximum_length ? `(${row.character_maximum_length})` : '';
      console.log(`  - ${row.column_name}: ${row.data_type}${maxLen}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

addCoverImageColumns()
  .then(() => {
    console.log('\n✅ Migration complete!');
    console.log('\n📸 Shows can now have portrait cover images (2:3 ratio)');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  });
