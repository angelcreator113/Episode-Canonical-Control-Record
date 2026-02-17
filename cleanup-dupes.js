const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  user: 'postgres',
  password: 'Ayanna123',
  database: 'episode_metadata'
});

client.connect().then(async () => {
  try {
    // Delete duplicate EPISODE scoped assets from current show
    const result = await client.query(
      `DELETE FROM assets 
       WHERE show_id = 'b0e3dd75-8485-4677-99a2-3e16168bbc55' 
       AND asset_scope = 'EPISODE'`
    );
    console.log('✓ Deleted', result.rowCount, 'EPISODE scoped assets');
    
    // Check what's left
    const remaining = await client.query(
      `SELECT COUNT(*) as count FROM assets 
       WHERE show_id = 'b0e3dd75-8485-4677-99a2-3e16168bbc55'`
    );
    console.log('✓ Remaining assets:', remaining.rows[0].count);
  } finally {
    client.end();
  }
}).catch(e => console.error('ERROR:', e.message));
