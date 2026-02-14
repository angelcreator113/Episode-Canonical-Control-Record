const { Client } = require('pg');
require('dotenv').config();

async function checkScenes() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    const result = await client.query(`
      SELECT id, title, raw_footage_s3_key, created_at 
      FROM scenes 
      WHERE episode_id = '2b7065de-f599-4c5b-95a7-61df8f91cffa'
      ORDER BY created_at DESC
    `);

    console.log('Scenes in database:');
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkScenes();
