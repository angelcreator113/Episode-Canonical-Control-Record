const { Pool } = require('pg');
const pool = new Pool({
  host: '127.0.0.1',
  user: 'postgres',
  password: 'Ayanna123',
  database: 'episode_metadata'
});

async function check() {
  try {
    // Check backgrounds for show b0e3dd75 with show_id filter
    let r = await pool.query(`
      SELECT id, name, location_name, show_id, asset_scope 
      FROM assets 
      WHERE category = 'background' 
        AND deleted_at IS NULL
        AND show_id = 'b0e3dd75-8485-4677-99a2-3e16168bbc55'
    `);
    console.log('=== Backgrounds with show_id = b0e3dd75... ===');
    console.log('Found:', r.rows.length);
    r.rows.forEach(a => console.log(' ', a.name, '| loc:', a.location_name || 'NULL', '| scope:', a.asset_scope));
    
    // Check with the exact API filter
    r = await pool.query(`
      SELECT id, name, location_name, show_id, asset_scope 
      FROM assets 
      WHERE category = 'background' 
        AND deleted_at IS NULL
        AND (
          show_id = 'b0e3dd75-8485-4677-99a2-3e16168bbc55'
          OR asset_scope = 'GLOBAL'
          OR show_id IS NULL
        )
    `);
    console.log('\n=== Backgrounds matching API filter (show_id OR GLOBAL) ===');
    console.log('Found:', r.rows.length);
    r.rows.forEach(a => console.log(' ', a.name, '| loc:', a.location_name || 'NULL', '| scope:', a.asset_scope, '| show:', a.show_id ? a.show_id.substr(0,8) : 'NULL'));
    
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    pool.end();
  }
}

check();
