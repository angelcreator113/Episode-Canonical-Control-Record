const { Client } = require('pg');

const client = new Client({
  host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
  database: 'postgres',
  user: 'postgres',
  password: 'Ayanna123!!',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixOutfitSets() {
  try {
    await client.connect();
    console.log('Connected to database');

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
    console.log('✅ outfit_sets table created');

    // Check the table
    const checkSQL = `SELECT column_name FROM information_schema.columns WHERE table_name = 'outfit_sets' ORDER BY ordinal_position`;
    const result = await client.query(checkSQL);
    console.log('\nColumns:', result.rows.map(r => r.column_name).join(', '));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

fixOutfitSets();
