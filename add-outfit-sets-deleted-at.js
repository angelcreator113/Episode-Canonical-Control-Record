const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
});

async function addDeletedAtColumn() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking if deleted_at column exists in outfit_sets...');
    
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'outfit_sets' 
      AND column_name = 'deleted_at';
    `;
    
    const checkResult = await client.query(checkQuery);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ deleted_at column already exists');
      return;
    }
    
    console.log('➕ Adding deleted_at column to outfit_sets table...');
    
    await client.query(`
      ALTER TABLE outfit_sets 
      ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    `);
    
    console.log('✅ Successfully added deleted_at column');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addDeletedAtColumn()
  .then(() => {
    console.log('✅ Migration complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
