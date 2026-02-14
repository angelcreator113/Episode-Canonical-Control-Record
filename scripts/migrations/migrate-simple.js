#!/usr/bin/env node

/**
 * Simplified Database Migration Runner
 * Uses direct SQL execution instead of Sequelize
 */

require('dotenv').config();

// Force using Google's public DNS for resolution
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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
console.log(`║  Simplified Database Migration Runner                         ║`);
console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

console.log(`Database: ${config.database}`);
console.log(`User: ${config.user}`);
console.log(`Host: ${config.host}\n`);

const client = new Client(config);

async function runMigrations() {
  try {
    await client.connect();
    console.log('✓ Database connection successful\n');

    // Create episodes table
    console.log('→ Creating episodes table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS episodes (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        duration INTEGER,
        status VARCHAR(50) DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ episodes table created\n');

    // Create metadata_storage table
    console.log('→ Creating metadata_storage table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS metadata_storage (
        id SERIAL PRIMARY KEY,
        episode_id INTEGER REFERENCES episodes(id),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ metadata_storage table created\n');

    // Create thumbnails table
    console.log('→ Creating thumbnails table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS thumbnails (
        id SERIAL PRIMARY KEY,
        episode_id INTEGER REFERENCES episodes(id),
        url VARCHAR(255),
        size_bytes INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ thumbnails table created\n');

    // Create processing_queue table
    console.log('→ Creating processing_queue table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS processing_queue (
        id SERIAL PRIMARY KEY,
        episode_id INTEGER REFERENCES episodes(id),
        task VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ processing_queue table created\n');

    // Create activity_logs table
    console.log('→ Creating activity_logs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        action VARCHAR(100),
        resource_type VARCHAR(100),
        resource_id INTEGER,
        changes JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ activity_logs table created\n');

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  ✓ All migrations completed successfully!                      ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
