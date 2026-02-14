const { Client } = require('pg');
require('dotenv').config();

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

  // Check scenes table structure
  console.log('🔍 Checking scenes table columns:');
  const scenesColumns = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'scenes' 
    ORDER BY ordinal_position
  `);
  console.log(scenesColumns.rows.map(r => `  ${r.column_name} (${r.data_type})`).join('\n'));

  // Add locked_at if missing
  const hasLockedAt = scenesColumns.rows.some(r => r.column_name === 'locked_at');
  if (!hasLockedAt) {
    console.log('\n⚠️  locked_at column missing, adding it...');
    await client.query('ALTER TABLE scenes ADD COLUMN locked_at TIMESTAMP');
    console.log('✅ locked_at column added');
  } else {
    console.log('\n✅ locked_at column exists');
  }

  // Check episode_templates table
  console.log('\n🔍 Checking episode_templates table columns:');
  const templateColumns = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'episode_templates' 
    ORDER BY ordinal_position
  `);
  console.log(templateColumns.rows.map(r => `  ${r.column_name} (${r.data_type})`).join('\n'));

  // Add slug if missing
  const hasSlug = templateColumns.rows.some(r => r.column_name === 'slug');
  if (!hasSlug) {
    console.log('\n⚠️  slug column missing, adding it...');
    await client.query('ALTER TABLE episode_templates ADD COLUMN slug VARCHAR(255)');
    console.log('✅ slug column added');
  } else {
    console.log('\n✅ slug column exists');
  }

  await client.end();
  console.log('\n👋 Done');
}

main().catch(console.error);
