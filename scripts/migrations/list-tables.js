const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkTables() {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    
    console.log('\nTables in database:');
    result.rows.forEach(row => console.log(`  - ${row.tablename}`));
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkTables().catch(console.error);
