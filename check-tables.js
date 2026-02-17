const pg = require('pg');

const pool = new pg.Pool({
  host: '127.0.0.1',
  user: 'postgres',
  password: 'Ayanna123',
  database: 'episode_metadata',
});

pool.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'episode_wardrobe_defaults'
  ORDER BY ordinal_position
`, (err, res) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Columns in episode_wardrobe_defaults:');
    res.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    const hasDeletedAt = res.rows.some(col => col.column_name === 'deleted_at');
    console.log(`\n${hasDeletedAt ? '✅' : '❌'} deleted_at column ${hasDeletedAt ? 'EXISTS' : 'MISSING'}`);
  }
  pool.end();
});



