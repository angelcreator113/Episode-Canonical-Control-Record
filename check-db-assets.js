const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  user: 'postgres',
  password: 'Ayanna123',
  database: 'episode_metadata'
});

client.connect().then(async () => {
  try {
    // Check what assets exist in ALL shows
    console.log('=== ALL BACKGROUND ASSETS ===');
    const result = await client.query(
      `SELECT id, name, show_id, entity_type, category, asset_scope, location_name 
       FROM assets 
       WHERE entity_type = 'environment' AND category = 'background'
       ORDER BY created_at DESC`
    );
    
    console.log('Total background assets in DB:', result.rows.length);
    result.rows.slice(0, 10).forEach((row, idx) => {
      console.log(`[${idx}] ${row.location_name} | show: ${row.show_id.substring(0, 8)}... | scope: ${row.asset_scope}`);
    });
    
    // Check specific show
    console.log('\n=== FOR CURRENT SHOW ===');
    const result2 = await client.query(
      `SELECT id, name, show_id, entity_type, category, asset_scope, location_name 
       FROM assets 
       WHERE show_id = 'b0e3dd75-8485-4677-99a2-3e16168bbc55' 
       AND entity_type = 'environment' 
       AND category = 'background'`
    );
    
    console.log('Count:', result2.rows.length);
    result2.rows.forEach((row, idx) => {
      console.log(`[${idx}] ${row.name}`);
      console.log(`     location: ${row.location_name}`);
      console.log(`     scope: ${row.asset_scope}`);
    });
    
    // Check what the most recent upload was
    console.log('\n=== RECENT UPLOADS ===');
    const result3 = await client.query(
      `SELECT id, name, show_id, entity_type, category, created_at 
       FROM assets 
       ORDER BY created_at DESC 
       LIMIT 5`
    );
    
    result3.rows.forEach((row, idx) => {
      console.log(`[${idx}] ${row.name}`);
      console.log(`     show: ${row.show_id}`);
      console.log(`     created: ${row.created_at}`);
    });
    
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    client.end();
  }
}).catch(e => console.error('CONNECTION ERROR:', e.message));
