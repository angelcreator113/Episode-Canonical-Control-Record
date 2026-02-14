const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkEpisodeScriptsSchema() {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'episode_scripts'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 episode_scripts table schema:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (${row.udt_name})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkEpisodeScriptsSchema();
