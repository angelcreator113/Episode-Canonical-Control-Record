const { Pool } = require('pg');
/* eslint-disable no-console */

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'episode_metadata'
});

async function checkSchema() {
  try {
    // Get episodes table structure
    const episodesRes = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'episodes'
      ORDER BY ordinal_position
    `);
    
    console.log('\n✓ EPISODES TABLE COLUMNS:');
    episodesRes.rows.forEach(r => {
      console.log(`  ${r.column_name}: ${r.data_type}${r.column_default ? ' DEFAULT ' + r.column_default : ''}${r.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    });

    // Get assets table structure
    const assetsRes = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'assets'
      ORDER BY ordinal_position
    `);
    
    console.log('\n✓ ASSETS TABLE COLUMNS:');
    assetsRes.rows.forEach(r => {
      console.log(`  ${r.column_name}: ${r.data_type}${r.column_default ? ' DEFAULT ' + r.column_default : ''}${r.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    });

    // Get thumbnail_compositions table structure
    const compRes = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'thumbnail_compositions'
      ORDER BY ordinal_position
    `);
    
    console.log('\n✓ THUMBNAIL_COMPOSITIONS TABLE COLUMNS:');
    compRes.rows.forEach(r => {
      console.log(`  ${r.column_name}: ${r.data_type}${r.column_default ? ' DEFAULT ' + r.column_default : ''}${r.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
