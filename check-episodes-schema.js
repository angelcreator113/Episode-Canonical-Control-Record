const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Ayanna123!!@episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com:5432/episode_metadata',
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkSchema() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check episodes table columns
    const episodesResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'episodes'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Episodes table columns:');
    episodesResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}${row.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    });

    // Check shows table columns
    const showsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'shows'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Shows table columns:');
    showsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}${row.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    });

    // Check what tables exist
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\n📋 All tables in database:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSchema();
