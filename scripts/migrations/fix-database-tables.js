/**
 * Manual Database Fix Script
 * Runs the SQL files directly against the dev database
 */

const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

const DB_HOST = 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com';
const DB_USER = 'postgres';
const DB_PASS = 'Ayanna123!!';
const DB_NAME = 'episode_metadata';

async function runSQL(client, filename) {
  try {
    console.log(`\n📝 Running ${filename}...`);
    const sql = fs.readFileSync(filename, 'utf8');
    await client.query(sql);
    console.log(`✅ ${filename} completed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ ${filename} failed:`, error.message);
    return false;
  }
}

async function main() {
  const client = new Client({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    port: 5432,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Run SQL files in order
    const files = [
      'create-scenes-table.sql',
      'create-scene-templates-table.sql',
      'create-episode-templates-table.sql'
    ];

    let successCount = 0;
    for (const file of files) {
      if (fs.existsSync(file)) {
        const success = await runSQL(client, file);
        if (success) successCount++;
      } else {
        console.log(`⚠️  File not found: ${file}`);
      }
    }

    console.log(`\n📊 Summary: ${successCount}/${files.length} files executed successfully`);
    
    // Verify tables exist
    console.log('\n🔍 Verifying tables...');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public' 
      AND table_name IN ('scenes', 'scene_templates', 'episode_templates')
      ORDER BY table_name
    `);
    
    console.log('Tables found:', result.rows.map(r => r.table_name));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n👋 Database connection closed');
  }
}

main().catch(console.error);
