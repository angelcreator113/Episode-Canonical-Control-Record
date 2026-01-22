/**
 * Migration: Add search history tracking
 * Tracks user search queries for analytics and recent searches
 */

exports.up = (pgm) => {
  // Create search_history table
  pgm.createTable('search_history', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    user_id: {
      type: 'varchar(255)',
      notNull: true,
      comment: 'User who performed the search',
    },
    query: {
      type: 'text',
      notNull: true,
      comment: 'Search query text',
    },
    search_type: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'Type: episodes, scripts, or activities',
    },
    filters: {
      type: 'jsonb',
      default: "'{}'::jsonb",
      comment: 'JSON object of applied filters',
    },
    result_count: {
      type: 'integer',
      default: 0,
      comment: 'Number of results returned',
    },
    clicked_result_id: {
      type: 'uuid',
      comment: 'UUID of result clicked (if any)',
    },
    search_duration_ms: {
      type: 'integer',
      comment: 'Search execution time in milliseconds',
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
  });

  // Add table comment
  pgm.sql("COMMENT ON TABLE search_history IS 'Tracks user search queries for analytics and recent searches'");

  // Create indexes
  pgm.createIndex('search_history', ['user_id', 'created_at'], {
    name: 'idx_search_history_user',
    method: 'btree',
  });

  pgm.sql(`
    CREATE INDEX idx_search_history_query 
    ON search_history USING gin(to_tsvector('english', query))
  `);

  pgm.createIndex('search_history', 'created_at', {
    name: 'idx_search_history_created',
    method: 'btree',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('search_history', { ifExists: true, cascade: true });
};
