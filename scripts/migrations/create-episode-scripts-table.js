/**
 * Migration: Create episode_scripts table
 * 
 * Supports multiple script types with version management, scene markers,
 * and file uploads for PDF/DOCX/TXT/Fountain formats.
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createEpisodeScriptsTable() {
  const client = await pool.connect();
  
  try {
    console.log('Creating episode_scripts table...');

    // Create the table
    await client.query(`
      CREATE TABLE IF NOT EXISTS episode_scripts (
        id SERIAL PRIMARY KEY,
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        
        -- Script identification
        script_type VARCHAR(50) NOT NULL CHECK (script_type IN ('trailer', 'main', 'shorts', 'teaser', 'behind-the-scenes', 'bonus-content')),
        version_number INTEGER NOT NULL DEFAULT 1,
        version_label VARCHAR(255), -- Optional custom label like "Director's Cut", "Studio Notes"
        
        -- Metadata
        author VARCHAR(255),
        status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'approved')),
        duration INTEGER, -- Estimated runtime in seconds
        scene_count INTEGER DEFAULT 0,
        
        -- Content
        content TEXT, -- Script text content
        file_format VARCHAR(20) CHECK (file_format IN ('txt', 'pdf', 'docx', 'fountain')),
        file_url VARCHAR(1024), -- S3 URL for uploaded files
        file_size BIGINT, -- File size in bytes
        
        -- Version control
        is_primary BOOLEAN DEFAULT FALSE, -- One primary per script_type per episode
        is_latest BOOLEAN DEFAULT TRUE, -- Latest version flag
        
        -- Scene markers for bi-directional linking
        scene_markers JSONB DEFAULT '[]'::jsonb, -- Array of {sceneId, timestamp, lineNumber}
        
        -- Audit fields
        created_by VARCHAR(255), -- Username or user identifier
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP WITH TIME ZONE
      );
    `);

    console.log('✓ episode_scripts table created');

    // Create indexes for performance
    console.log('Creating indexes...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_episode_scripts_episode_id 
      ON episode_scripts(episode_id) WHERE deleted_at IS NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_episode_scripts_script_type 
      ON episode_scripts(script_type) WHERE deleted_at IS NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_episode_scripts_status 
      ON episode_scripts(status) WHERE deleted_at IS NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_episode_scripts_primary 
      ON episode_scripts(episode_id, script_type, is_primary) 
      WHERE deleted_at IS NULL AND is_primary = TRUE;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_episode_scripts_latest 
      ON episode_scripts(episode_id, script_type, is_latest) 
      WHERE deleted_at IS NULL AND is_latest = TRUE;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_episode_scripts_author 
      ON episode_scripts(author) WHERE deleted_at IS NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_episode_scripts_created_at 
      ON episode_scripts(created_at) WHERE deleted_at IS NULL;
    `);

    console.log('✓ Indexes created');

    // Create unique constraint for primary scripts
    console.log('Creating constraints...');
    
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_episode_scripts_unique_primary 
      ON episode_scripts(episode_id, script_type) 
      WHERE deleted_at IS NULL AND is_primary = TRUE;
    `);

    console.log('✓ Constraints created');

    // Create trigger to update updated_at timestamp
    console.log('Creating triggers...');

    await client.query(`
      CREATE OR REPLACE FUNCTION update_episode_scripts_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS episode_scripts_update_timestamp ON episode_scripts;
      CREATE TRIGGER episode_scripts_update_timestamp
        BEFORE UPDATE ON episode_scripts
        FOR EACH ROW
        EXECUTE FUNCTION update_episode_scripts_timestamp();
    `);

    console.log('✓ Triggers created');

    // Verify table structure
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'episode_scripts'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Table structure:');
    console.table(result.rows);

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Error creating episode_scripts table:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
if (require.main === module) {
  createEpisodeScriptsTable()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { createEpisodeScriptsTable };
