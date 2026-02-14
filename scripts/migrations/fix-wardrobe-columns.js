const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
});

const requiredColumns = [
  { name: 'description', type: 'TEXT' },
  { name: 'notes', type: 'TEXT' },
  { name: 'color', type: 'VARCHAR(100)' },
  { name: 'season', type: 'VARCHAR(50)' },
  { name: 'tags', type: 'TEXT[]' },
  { name: 'is_favorite', type: 'BOOLEAN DEFAULT false' }
];

async function fixWardrobeColumns() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking wardrobe table columns...');
    
    // Get existing columns
    const existingColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'wardrobe';
    `);
    
    const existingColumnNames = existingColumns.rows.map(row => row.column_name);
    console.log('📋 Existing columns:', existingColumnNames);
    
    // Add missing columns
    for (const column of requiredColumns) {
      if (!existingColumnNames.includes(column.name)) {
        console.log(`➕ Adding column: ${column.name} (${column.type})`);
        await client.query(`
          ALTER TABLE wardrobe 
          ADD COLUMN ${column.name} ${column.type};
        `);
        console.log(`✅ Added ${column.name}`);
      } else {
        console.log(`✓ Column ${column.name} already exists`);
      }
    }
    
    console.log('✅ All required columns are present');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixWardrobeColumns()
  .then(() => {
    console.log('✅ Migration complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
