/**
 * Migration: Create search-related tables
 * Tracks search history and saved searches
 */

async function up(db) {
  // Create search history table
  await db.query(`
    CREATE TABLE IF NOT EXISTS search_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      query TEXT NOT NULL,
      result_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Index on user_id for efficient retrieval of user's search history
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_search_history_user_id 
    ON search_history(user_id, created_at DESC);
  `);

  // Index on query for analytics
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_search_history_query 
    ON search_history(query, created_at DESC);
  `);

  // Create saved searches table
  await db.query(`
    CREATE TABLE IF NOT EXISTS saved_searches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      query TEXT NOT NULL,
      filters JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      deleted_at TIMESTAMP
    );
  `);

  // Index on user_id for retrieving user's saved searches
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id 
    ON saved_searches(user_id, created_at DESC);
  `);

  // Index for soft delete filtering
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_saved_searches_deleted 
    ON saved_searches(deleted_at);
  `);

  // Create search analytics table
  await db.query(`
    CREATE TABLE IF NOT EXISTS search_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      query TEXT NOT NULL,
      total_searches INTEGER DEFAULT 0,
      total_results INTEGER DEFAULT 0,
      avg_response_time_ms INTEGER DEFAULT 0,
      last_searched_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Unique index on query for analytics aggregation
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_search_analytics_query 
    ON search_analytics(query);
  `);

  // Create search suggestions table (for frequently used terms)
  await db.query(`
    CREATE TABLE IF NOT EXISTS search_suggestions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      term TEXT NOT NULL UNIQUE,
      frequency INTEGER DEFAULT 1,
      category VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Index on frequency for ranking suggestions
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_search_suggestions_frequency 
    ON search_suggestions(frequency DESC);
  `);

  // Index on category for filtering
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_search_suggestions_category 
    ON search_suggestions(category);
  `);
}

async function down(db) {
  await db.query(`DROP TABLE IF EXISTS search_history CASCADE`);
  await db.query(`DROP TABLE IF EXISTS saved_searches CASCADE`);
  await db.query(`DROP TABLE IF EXISTS search_analytics CASCADE`);
  await db.query(`DROP TABLE IF EXISTS search_suggestions CASCADE`);
}

module.exports = { up, down };
