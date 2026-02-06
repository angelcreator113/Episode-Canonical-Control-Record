const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function insertMigrationRecord() {
  const client = await pool.connect();
  
  try {
    // Insert the migration record
    await client.query(`
      INSERT INTO pgmigrations (name, run_on)
      VALUES ('20260205000001-add-ai-editing-tables', NOW())
    `);
    
    console.log('✅ Migration record inserted successfully');
    console.log('   Now running the actual migration SQL...');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

insertMigrationRecord();
