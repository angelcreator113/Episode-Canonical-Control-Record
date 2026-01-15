const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'episode_metadata',
});

async function verifyTables() {
  try {
    const result = await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
    );
    
    console.log('✓ Database Tables Created:');
    result.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.tablename}`);
    });
    
    // Verify specific tables
    const requiredTables = [
      'episodes',
      'thumbnail_templates',
      'assets',
      'thumbnail_compositions',
      'thumbnails',
      'processing_queue',
      'file_storages',
      'composition_versions',
      'pgmigrations'
    ];
    
    console.log('\n✓ Required Tables Status:');
    requiredTables.forEach(table => {
      const exists = result.rows.some(r => r.tablename === table);
      console.log(`  ${exists ? '✓' : '✗'} ${table}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

verifyTables();
