// Add deleted_at column to storyteller_echoes
const { Client } = require('pg');
const client = new Client({
  host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'postgres',
  password: 'Ayanna123!!',
  database: 'episode_metadata',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  await client.connect();
  await client.query('ALTER TABLE storyteller_echoes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ');
  console.log('Added deleted_at column');
  await client.end();
}
run().catch(e => { console.error(e); process.exit(1); });
