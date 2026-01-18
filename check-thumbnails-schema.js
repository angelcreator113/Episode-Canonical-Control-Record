const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: 'postgresql://postgres:postgres@localhost:5432/episode_metadata' 
});

pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'thumbnails' 
  ORDER BY ordinal_position
`)
.then(result => {
  console.log('✓ THUMBNAILS TABLE COLUMNS:');
  result.rows.forEach(row => {
    console.log(`  ${row.column_name}: ${row.data_type}`);
  });
  pool.end();
})
.catch(err => {
  console.error('Error:', err.message);
  pool.end();
  process.exit(1);
});
