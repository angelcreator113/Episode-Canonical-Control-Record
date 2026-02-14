/**
 * Migration: Create script_edits table for audit trail
 * 
 * Tracks all edits made to scripts for complete edit history
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createScriptEditsTable() {
  const client = await pool.connect();
  
  try {
    console.log('Creating script_edits table...');

    // Create the table
    await client.query(`
      CREATE TABLE IF NOT EXISTS script_edits (
        id SERIAL PRIMARY KEY,
        script_id INTEGER NOT NULL REFERENCES episode_scripts(id) ON DELETE CASCADE,
        user_id VARCHAR(255), -- Username or user identifier
        
        -- Change tracking
        changes JSONB NOT NULL, -- {before: {field: value}, after: {field: value}, diff: "text diff"}
        edit_type VARCHAR(50) NOT NULL CHECK (edit_type IN ('create', 'update', 'delete', 'restore', 'set_primary')),
        
        -- Additional context
        ip_address VARCHAR(45),
        user_agent TEXT,
        
        -- Timestamp
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✓ script_edits table created');

    // Create indexes
    console.log('Creating indexes...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_script_edits_script_id 
      ON script_edits(script_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_script_edits_user_id 
      ON script_edits(user_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_script_edits_created_at 
      ON script_edits(created_at);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_script_edits_type 
      ON script_edits(edit_type);
    `);

    console.log('✓ Indexes created');

    // Verify table structure
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'script_edits'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Table structure:');
    console.table(result.rows);

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Error creating script_edits table:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
if (require.main === module) {
  createScriptEditsTable()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { createScriptEditsTable };
