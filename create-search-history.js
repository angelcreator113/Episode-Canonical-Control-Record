/**
 * Standalone script to create search_history table
 * Run with: node create-search-history.js
 */

require('dotenv').config();
const { getPool } = require('./src/config/database');

async function createSearchHistory() {
  const db = getPool();

  try {
    console.log('Creating search_history table...\n');

    // Create table
    await db.query(`
      CREATE TABLE IF NOT EXISTS search_history (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        query TEXT NOT NULL,
        search_type VARCHAR(50) NOT NULL,
        filters JSONB DEFAULT '{}',
        result_count INTEGER DEFAULT 0,
        clicked_result_id UUID,
        search_duration_ms INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ Created search_history table');

    // Create indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_search_history_user 
      ON search_history(user_id, created_at DESC);
    `);
    console.log('✓ Created index: idx_search_history_user');

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_search_history_query 
      ON search_history USING gin(to_tsvector('english', query));
    `);
    console.log('✓ Created index: idx_search_history_query');

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_search_history_created 
      ON search_history(created_at DESC);
    `);
    console.log('✓ Created index: idx_search_history_created');

    // Add comments
    await db.query(`
      COMMENT ON TABLE search_history IS 'Tracks user search queries for analytics and recent searches';
    `);
    console.log('✓ Added table comment');

    await db.query(`
      COMMENT ON COLUMN search_history.user_id IS 'User who performed the search';
      COMMENT ON COLUMN search_history.query IS 'Search query text';
      COMMENT ON COLUMN search_history.search_type IS 'Type: episodes, scripts, or activities';
      COMMENT ON COLUMN search_history.filters IS 'JSON object of applied filters';
      COMMENT ON COLUMN search_history.result_count IS 'Number of results returned';
      COMMENT ON COLUMN search_history.clicked_result_id IS 'UUID of result clicked (if any)';
      COMMENT ON COLUMN search_history.search_duration_ms IS 'Search execution time in milliseconds';
    `);
    console.log('✓ Added column comments');

    // Verify table exists
    const result = await db.query(`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'search_history') as column_count
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'search_history';
    `);

    if (result.rows.length > 0) {
      console.log(`\n✅ Verification: search_history table exists with ${result.rows[0].column_count} columns`);
    }

    // Show indexes
    const indexes = await db.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'search_history'
      ORDER BY indexname;
    `);

    console.log(`\n✅ Created ${indexes.rows.length} indexes:`);
    indexes.rows.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
    });

    console.log('\n🎉 search_history table setup complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating search_history table:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createSearchHistory();
