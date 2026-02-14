#!/usr/bin/env node

/**
 * Add distribution_defaults column to shows table
 */

require('dotenv').config();
const { Client } = require('pg');

const config = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 30000,
  statement_timeout: 30000,
};

console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
console.log(`║  Add Show Distribution Defaults Column                        ║`);
console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

console.log(`Database: ${config.database}`);
console.log(`Host: ${config.host}\n`);

const client = new Client(config);

async function migrate() {
  try {
    await client.connect();
    console.log('✓ Database connection successful\n');

    console.log('→ Adding distribution_defaults column to shows table...');
    await client.query(`
      ALTER TABLE shows 
      ADD COLUMN IF NOT EXISTS distribution_defaults JSONB;
    `);
    console.log('✓ Column added successfully\n');

    console.log('→ Adding column comment...');
    await client.query(`
      COMMENT ON COLUMN shows.distribution_defaults 
      IS 'Show-level distribution defaults per platform (account credentials, default hashtags, brand guidelines)';
    `);
    console.log('✓ Comment added successfully\n');

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
