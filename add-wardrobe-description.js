const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
});

async function addDescriptionColumn() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking if description column exists...');
    
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'wardrobe' 
      AND column_name = 'description';
    `;
    
    const checkResult = await client.query(checkQuery);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ description column already exists');
      return;
    }
    
    console.log('➕ Adding description column to wardrobe table...');
    
    await client.query(`
      ALTER TABLE wardrobe 
      ADD COLUMN description TEXT;
    `);
    
    console.log('✅ Successfully added description column');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addDescriptionColumn()
  .then(() => {
    console.log('✅ Migration complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
