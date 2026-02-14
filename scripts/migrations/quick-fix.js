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
  
  await client.query(`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS assets JSONB DEFAULT '{}'::jsonb`);
  console.log('✅ Added assets to scenes');
  
  await client.query(`ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0`);
  console.log('✅ Added usage_count to episode_templates');
  
  await client.query(`ALTER TABLE episode_templates ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false`);
  console.log('✅ Added is_default to episode_templates');
  
  await client.end();
}

main().catch(console.error);
