const { Client } = require('pg');

const client = new Client({
  host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
  user: 'postgres',
  password: 'Ayanna123!!',
  database: 'episode_metadata',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('✅ Connected\n');
  
  const columns = [
    'is_system_template BOOLEAN DEFAULT false',
    'last_used_at TIMESTAMP',
    'created_by VARCHAR(255)',
    'updated_by VARCHAR(255)',
  ];
  
  for (const col of columns) {
    try {
      await client.query(`ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS ${col}`);
      console.log(`✅ Added ${col.split(' ')[0]}`);
    } catch (e) {
      console.log(`⚠️  ${col}: ${e.message}`);
    }
  }
  
  await client.end();
  console.log('\n✅ All done!');
}

main().catch(console.error);
