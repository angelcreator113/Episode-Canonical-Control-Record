// Add deleted_at column to new notification tables
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
  const tables = ['lalaverse_brands', 'wardrobe_brand_tags', 'therapy_pending_sessions'];
  for (const t of tables) {
    try {
      await client.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
      console.log(`Added deleted_at to ${t}`);
    } catch(e) {
      console.log(`${t}: ${e.message}`);
    }
  }
  await client.end();
}
run().catch(e => { console.error(e); process.exit(1); });
