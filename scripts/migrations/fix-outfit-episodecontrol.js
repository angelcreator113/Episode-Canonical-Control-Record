const { Client } = require('pg');

async function checkDatabase() {
  // Try the episode_metadata database
  const client = new Client({
    host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
    database: 'episode_metadata',
    user: 'postgres',
    password: 'Ayanna123!!',
    port: 5432,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to episode_metadata database');

    // Check if table exists
    const checkSQL = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'outfit_sets'
    `;
    const result = await client.query(checkSQL);
    
    if (result.rows.length > 0) {
      console.log('✅ outfit_sets table exists in episode_metadata');
    } else {
      console.log('❌ outfit_sets table does NOT exist in episode_metadata');
      
      // Create it
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS outfit_sets (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          character VARCHAR(255),
          occasion VARCHAR(255),
          season VARCHAR(255),
          items JSON DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP
        );
      `;
      await client.query(createTableSQL);
      console.log('✅ Created outfit_sets table in episode_metadata');
    }

    // List columns
    const columnsSQL = `SELECT column_name FROM information_schema.columns WHERE table_name = 'outfit_sets' ORDER BY ordinal_position`;
    const cols = await client.query(columnsSQL);
    console.log('\nColumns:', cols.rows.map(r => r.column_name).join(', '));

  } catch (error) {
    console.error('❌ Error with episode_metadata:', error.message);
  } finally {
    await client.end();
  }
}

checkDatabase();
