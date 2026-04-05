#!/usr/bin/env node
'use strict';

/**
 * Database Diagnostic Script
 * Run on the dev server to check why data appears missing.
 *
 * Usage:
 *   node scripts/diagnose-db.js
 *   # Or with explicit connection string:
 *   DATABASE_URL="postgresql://..." node scripts/diagnose-db.js
 */

const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '../.env') }); } catch {}

const { Pool } = require('pg');

const connString = process.env.DATABASE_URL;

console.log('\n=== DATABASE DIAGNOSTIC ===\n');
console.log('DATABASE_URL:', connString ? connString.replace(/:[^@]+@/, ':***@') : 'NOT SET');
console.log('DB_HOST:', process.env.DB_HOST || 'NOT SET');
console.log('DB_NAME:', process.env.DB_NAME || 'NOT SET');
console.log('DB_SSL:', process.env.DB_SSL || 'NOT SET');
console.log('ENABLE_DB_SYNC:', process.env.ENABLE_DB_SYNC || 'NOT SET');
console.log('DB_SYNC_FORCE:', process.env.DB_SYNC_FORCE || 'NOT SET');
console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');

if (!connString && !process.env.DB_HOST) {
  console.error('\n❌ No DATABASE_URL or DB_HOST set. Cannot connect.');
  process.exit(1);
}

const poolConfig = connString
  ? { connectionString: connString, ssl: { rejectUnauthorized: false } }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'neondb',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

(async () => {
  try {
    // 1. Basic connection check
    const { rows: [info] } = await pool.query(
      "SELECT current_database() as db, current_user as usr, inet_server_addr() as addr, version() as ver"
    );
    console.log('\n✅ Connected successfully');
    console.log('  Database:', info.db);
    console.log('  User:', info.usr);
    console.log('  Server:', info.addr || '(pooler)');
    console.log('  PG Version:', info.ver.split(',')[0]);

    // 2. List all tables
    const { rows: tables } = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log(`\n📋 Tables found: ${tables.length}`);

    // 3. Row counts for key tables
    const keyTables = [
      'shows', 'episodes', 'scenes', 'assets', 'wardrobe',
      'world_events', 'franchise_knowledge', 'scene_sets',
      'characters', 'episode_briefs', 'scene_plans',
    ];

    console.log('\n📊 Row counts:');
    console.log('  %-30s %8s %12s', 'Table', 'Active', 'Soft-Deleted');
    console.log('  ' + '-'.repeat(52));

    for (const table of keyTables) {
      const exists = tables.some(t => t.table_name === table);
      if (!exists) {
        console.log('  %-30s %s', table, '(table not found)');
        continue;
      }

      try {
        // Check if table has deleted_at column
        const { rows: cols } = await pool.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = 'deleted_at'",
          [table]
        );
        const hasDeletedAt = cols.length > 0;

        if (hasDeletedAt) {
          const { rows: [counts] } = await pool.query(
            `SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL) as active, COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted FROM "${table}"`
          );
          console.log('  %-30s %8s %12s', table, counts.active, counts.deleted);
        } else {
          const { rows: [counts] } = await pool.query(`SELECT COUNT(*) as total FROM "${table}"`);
          console.log('  %-30s %8s %12s', table, counts.total, 'n/a');
        }
      } catch (e) {
        console.log('  %-30s %s', table, `ERROR: ${e.message}`);
      }
    }

    // 4. Check if SequelizeMeta exists (migration tracking)
    const hasMeta = tables.some(t => t.table_name === 'SequelizeMeta');
    if (hasMeta) {
      const { rows } = await pool.query("SELECT name FROM \"SequelizeMeta\" ORDER BY name DESC LIMIT 5");
      console.log('\n📦 Last 5 migrations:');
      rows.forEach(r => console.log('  ', r.name));
    }

    // 5. Check for recent deletions
    const showsExists = tables.some(t => t.table_name === 'shows');
    if (showsExists) {
      try {
        const { rows: cols } = await pool.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name = 'shows' AND column_name = 'deleted_at'"
        );
        if (cols.length > 0) {
          const { rows: deleted } = await pool.query(
            "SELECT id, name, deleted_at FROM shows WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 10"
          );
          if (deleted.length > 0) {
            console.log('\n⚠️  Recently soft-deleted shows:');
            deleted.forEach(r => console.log(`  ${r.name} — deleted ${r.deleted_at}`));
            console.log('\n💡 To restore: UPDATE shows SET deleted_at = NULL WHERE deleted_at IS NOT NULL;');
          }
        }
      } catch (e) {
        console.log('Could not check deleted shows:', e.message);
      }
    }

    console.log('\n=== DIAGNOSTIC COMPLETE ===\n');
  } catch (err) {
    console.error('\n❌ Connection failed:', err.message);
    if (err.message.includes('SSL') || err.message.includes('ssl')) {
      console.error('💡 Try setting DB_SSL=true in your .env file');
    }
    if (err.message.includes('channel_binding')) {
      console.error('💡 The channel_binding=require parameter may be incompatible.');
      console.error('   Try removing it from your DATABASE_URL or using a direct (non-pooler) connection.');
    }
  } finally {
    await pool.end();
  }
})();
