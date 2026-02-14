const { Client } = require('pg');
require('dotenv').config();

async function makeSceneNumberNullable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    console.log('Making scene_number nullable...');
    await client.query(`
      ALTER TABLE scenes 
      ALTER COLUMN scene_number DROP NOT NULL
    `);
    console.log('✓ scene_number is now nullable');

    console.log('\nMigration complete!');
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

makeSceneNumberNullable()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
