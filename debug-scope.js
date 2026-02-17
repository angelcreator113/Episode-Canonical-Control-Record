const { Pool } = require('pg');

const pool = new Pool({
  host: '127.0.0.1',
  user: 'postgres',
  password: 'Ayanna123',
  database: 'episode_metadata',
});

async function test() {
  try {
    // Check what asset_scope the newly uploaded asset has
    const res = await pool.query(`
      SELECT id, name, asset_scope, show_id, entity_type, category
      FROM assets 
      WHERE id = '4d32a229-ab40-4535-84bb-94928a032d4a'
    `);
    
    console.log('Newly uploaded asset:');
    if (res.rows[0]) {
      console.log(JSON.stringify(res.rows[0], null, 2));
    } else {
      console.log('Asset not found');
    }
    
    // Check how many assets match the query the frontend is making
    const queryRes = await pool.query(`
      SELECT COUNT(*), asset_scope, show_id IS NOT NULL as has_show_id
      FROM assets 
      WHERE show_id = '32bfbf8b-1f46-46dd-8a5d-3b705d324c1b' 
      AND asset_scope = 'SHOW'
      GROUP BY asset_scope, has_show_id
    `);
    
    console.log('\nAssets matching show_id+SHOW scope query:');
    console.log(JSON.stringify(queryRes.rows, null, 2));
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

test();
