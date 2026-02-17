#!/usr/bin/env node
/**
 * Quick diagnostic script to check assets in database
 */
const { Pool } = require('pg');

const pool = new Pool({
  host: '127.0.0.1',
  user: 'postgres',
  password: 'Ayanna123',
  database: 'episode_metadata',
});

async function checkAssets() {
  try {
    console.log('📊 Checking assets in database...\n');

    // Check total assets
    const totalRes = await pool.query('SELECT COUNT(*) FROM assets');
    console.log(`📁 Total assets in DB: ${totalRes.rows[0].count}`);

    // Check assets with show_id set
    const showIdRes = await pool.query('SELECT COUNT(*) FROM assets WHERE show_id IS NOT NULL');
    console.log(`🎬 Assets with show_id: ${showIdRes.rows[0].count}`);

    // Check assets with background category
    const bgRes = await pool.query(
      "SELECT COUNT(*) FROM assets WHERE category = 'background' OR category LIKE 'background%'"
    );
    console.log(`🖼️  Assets with background category: ${bgRes.rows[0].count}`);

    // Check assets with environment entity_type
    const envRes = await pool.query("SELECT COUNT(*) FROM assets WHERE entity_type = 'environment'");
    console.log(`🌍 Assets with environment entity_type: ${envRes.rows[0].count}`);

    // Show first few background assets
    console.log('\n📋 Sample background assets:');
    const sampleRes = await pool.query(
      `SELECT id, name, category, entity_type, show_id, s3_url_raw 
       FROM assets 
       WHERE category = 'background' OR entity_type = 'environment'
       LIMIT 5`
    );
    sampleRes.rows.forEach((row) => {
      console.log(`  - ${row.name} (id: ${row.id})`);
      console.log(`    category: ${row.category}, entity_type: ${row.entity_type}`);
      console.log(`    show_id: ${row.show_id}`);
      console.log(`    has S3 URL: ${!!row.s3_url_raw}`);
    });

    // Show all show_ids
    console.log('\n🎭 All show_ids in assets:');
    const showRes = await pool.query('SELECT DISTINCT show_id FROM assets WHERE show_id IS NOT NULL LIMIT 10');
    if (showRes.rows.length === 0) {
      console.log('  ❌ No show_ids found!');
    } else {
      showRes.rows.forEach((row) => {
        console.log(`  - ${row.show_id}`);
      });
    }

    pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    pool.end();
    process.exit(1);
  }
}

checkAssets();
