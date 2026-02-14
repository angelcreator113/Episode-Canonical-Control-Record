/**
 * Add full-text search index to episode_scripts
 * Run this directly with Node.js
 */

require('dotenv').config();
const { getPool } = require('./src/config/database');

async function addScriptIndex() {
  const db = getPool();

  try {
    console.log('Creating full-text search index on episode_scripts...');

    await db.query(`
      -- Create GIN index for full-text search on episode_scripts
      CREATE INDEX IF NOT EXISTS idx_episode_scripts_fulltext 
      ON episode_scripts 
      USING gin(
        to_tsvector('english', 
          COALESCE(content, '') || ' ' || 
          COALESCE(version_label, '') || ' ' ||
          COALESCE(author, '') || ' ' ||
          COALESCE(script_type, '')
        )
      )
      WHERE deleted_at IS NULL;
    `);

    console.log('✅ Created index: idx_episode_scripts_fulltext');

    await db.query(`
      COMMENT ON INDEX idx_episode_scripts_fulltext IS 
      'Full-text search index for script content, version labels, author names, and script types';
    `);

    console.log('✅ Added index comment');

    // Verify the index was created
    const result = await db.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'episode_scripts'
        AND indexname = 'idx_episode_scripts_fulltext'
    `);

    if (result.rows.length > 0) {
      console.log('\n✅ INDEX VERIFIED');
      console.log('   Name:', result.rows[0].indexname);
      console.log('   Table:', result.rows[0].tablename);
      console.log('   Definition:', result.rows[0].indexdef.substring(0, 120) + '...');
    } else {
      console.log('\n⚠️  Index not found in pg_indexes');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating index:', error.message);
    process.exit(1);
  }
}

addScriptIndex();
