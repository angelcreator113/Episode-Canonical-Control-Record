/**
 * Create outfit_sets table
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function createOutfitSetsTable() {
  try {
    console.log('Creating outfit_sets table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS outfit_sets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        character VARCHAR(255),
        occasion VARCHAR(100),
        season VARCHAR(50),
        items JSON DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✓ outfit_sets table created');
    
    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_outfit_sets_character ON outfit_sets(character);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_outfit_sets_occasion ON outfit_sets(occasion);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_outfit_sets_season ON outfit_sets(season);
    `);
    
    console.log('✓ Indexes created');
    
    console.log('✅ Migration completed successfully');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

createOutfitSetsTable();
