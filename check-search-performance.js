const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function checkSearchPerformance() {
  try {
    console.log('=== 1. Testing Search Query Performance ===\n');
    const searchQuery = `
      EXPLAIN ANALYZE 
      SELECT id, title, description 
      FROM episodes 
      WHERE title ILIKE '%test%' OR description ILIKE '%test%'
    `;
    
    const searchResult = await pool.query(searchQuery);
    console.log('Search Query Plan:');
    searchResult.rows.forEach(row => console.log(row['QUERY PLAN']));
    
    console.log('\n=== 2. Checking Search Indexes ===\n');
    const indexQuery = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename IN ('episodes', 'activity_logs', 'episode_scripts')
      ORDER BY tablename, indexname
    `;
    
    const indexResult = await pool.query(indexQuery);
    console.log(`Found ${indexResult.rows.length} indexes:`);
    indexResult.rows.forEach(row => {
      console.log(`\nTable: ${row.tablename}`);
      console.log(`Index: ${row.indexname}`);
      console.log(`Definition: ${row.indexdef}`);
    });
    
    console.log('\n=== 3. Checking Table Sizes ===\n');
    const sizeQuery = `
      SELECT 
        schemaname,
        relname as tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS size,
        n_live_tup AS row_count
      FROM pg_stat_user_tables
      WHERE relname IN ('episodes', 'activity_logs', 'episode_scripts')
      ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC
    `;
    
    const sizeResult = await pool.query(sizeQuery);
    console.log('Table Sizes:');
    console.table(sizeResult.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSearchPerformance();
