const { Client } = require('pg');
require('dotenv').config();

async function checkRecentScenes() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    const result = await client.query(`
      SELECT id, title, scene_number, raw_footage_s3_key, duration_seconds, created_at 
      FROM scenes 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    console.log('Recent Scenes:');
    console.log('='.repeat(100));
    if (result.rows.length === 0) {
      console.log('No scenes found.');
    } else {
      result.rows.forEach((row, i) => {
        console.log(`\n${i + 1}. Scene ID: ${row.id}`);
        console.log(`   Title: ${row.title || 'NULL'}`);
        console.log(`   Scene Number: ${row.scene_number || 'NULL'}`);
        console.log(`   S3 Key: ${row.raw_footage_s3_key || 'NULL'}`);
        console.log(`   Duration: ${row.duration_seconds || 'NULL'} seconds`);
        console.log(`   Created: ${row.created_at}`);
      });
    }
    console.log('\n' + '='.repeat(100));
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

checkRecentScenes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
