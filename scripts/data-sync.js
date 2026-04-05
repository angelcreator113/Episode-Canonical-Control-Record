#!/usr/bin/env node
'use strict';

/**
 * Data Sync — Cross-Environment Migration Tool
 *
 * Exports data from one database (dev/staging/production) and imports
 * into another. Handles UUID conflicts, dry-run mode, table filtering.
 *
 * Setup:
 *   Add to .env:
 *     DATABASE_URL_DEV=postgresql://user:pass@host:5432/db?sslmode=require
 *     DATABASE_URL_PROD=postgresql://user:pass@host:5432/db?sslmode=require
 *
 *   Or pass connection strings directly via --source-url / --target-url
 *
 * Usage:
 *   # Export events from dev
 *   node scripts/data-sync.js export --table world_events --env dev --show-id UUID
 *
 *   # Import into production (dry run)
 *   node scripts/data-sync.js import --file exports/world_events.json --env production --dry-run
 *
 *   # Import for real
 *   node scripts/data-sync.js import --file exports/world_events.json --env production
 *
 *   # Sync a table directly (export + import in one step)
 *   node scripts/data-sync.js sync --table world_events --from dev --to production --show-id UUID
 *
 *   # List available tables
 *   node scripts/data-sync.js tables --env dev
 *
 *   # Export multiple tables at once
 *   node scripts/data-sync.js export --tables world_events,wardrobe,franchise_knowledge --env dev
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env
try { require('dotenv').config({ path: path.join(__dirname, '../.env') }); } catch {}

// ─── SUPPORTED TABLES ─────────────────────────────────────────────────────────

const SYNCABLE_TABLES = {
  world_events: {
    label: 'Events Library',
    filter: 'show_id = :showId',
    hasDeletedAt: false,
  },
  wardrobe: {
    label: 'Wardrobe Items',
    filter: 'show_id = :showId',
    hasDeletedAt: true,
  },
  franchise_knowledge: {
    label: 'Show Brain / Franchise Laws',
    filter: null, // global — no show filter
    hasDeletedAt: false,
  },
  scene_sets: {
    label: 'Scene Sets',
    filter: 'show_id = :showId',
    hasDeletedAt: true,
  },
  scene_angles: {
    label: 'Scene Angles',
    filter: 'scene_set_id IN (SELECT id FROM scene_sets WHERE show_id = :showId)',
    hasDeletedAt: true,
  },
  episodes: {
    label: 'Episodes',
    filter: 'show_id = :showId',
    hasDeletedAt: true,
  },
  shows: {
    label: 'Shows',
    filter: 'id = :showId',
    hasDeletedAt: true,
  },
  episode_briefs: {
    label: 'Episode Briefs',
    filter: 'show_id = :showId',
    hasDeletedAt: true,
  },
  scene_plans: {
    label: 'Scene Plans',
    filter: 'episode_id IN (SELECT id FROM episodes WHERE show_id = :showId)',
    hasDeletedAt: true,
  },
  world_locations: {
    label: 'World Locations',
    filter: null,
    hasDeletedAt: false,
  },
  assets: {
    label: 'Assets',
    filter: 'show_id = :showId',
    hasDeletedAt: true,
  },
  episode_todo_lists: {
    label: 'Episode To-Do Lists',
    filter: 'show_id = :showId',
    hasDeletedAt: true,
  },
};

// ─── CONNECTION HELPER ────────────────────────────────────────────────────────

function getConnectionUrl(env) {
  const envKey = `DATABASE_URL_${env.toUpperCase()}`;
  const url = process.env[envKey] || process.env.DATABASE_URL;
  if (!url) {
    console.error(`No database URL found for environment "${env}".`);
    console.error(`Set ${envKey} in your .env file or pass --source-url / --target-url`);
    process.exit(1);
  }
  return url;
}

function createPool(connectionUrl) {
  return new Pool({
    connectionString: connectionUrl,
    ssl: connectionUrl.includes('neon') || connectionUrl.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : false,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });
}

// ─── PARSE ARGS ───────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const opts = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace(/^--/, '').replace(/-/g, '_');
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        opts[key] = true;
      } else {
        opts[key] = next;
        i++;
      }
    }
  }

  return { command, ...opts };
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────

async function exportData(opts) {
  const tables = opts.tables
    ? opts.tables.split(',').map(t => t.trim())
    : opts.table
      ? [opts.table]
      : null;

  if (!tables) {
    console.error('Specify --table <name> or --tables <name1,name2,...>');
    console.error('Available:', Object.keys(SYNCABLE_TABLES).join(', '));
    process.exit(1);
  }

  const env = opts.env || 'dev';
  const url = opts.source_url || getConnectionUrl(env);
  const showId = opts.show_id || null;
  const pool = createPool(url);

  console.log(`\nExporting from ${env}...`);
  if (showId) console.log(`Show filter: ${showId}`);

  const exportDir = path.join(__dirname, '../exports');
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  const results = {};

  for (const table of tables) {
    const config = SYNCABLE_TABLES[table];
    if (!config) {
      console.warn(`  ⚠ Unknown table: ${table} (skipping)`);
      continue;
    }

    let query = `SELECT * FROM ${table}`;
    const params = [];
    const conditions = [];

    if (config.filter && showId) {
      conditions.push(config.filter.replace(/:showId/g, `$1`));
      params.push(showId);
    }
    if (config.hasDeletedAt) {
      conditions.push('deleted_at IS NULL');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at ASC';

    try {
      const { rows } = await pool.query(query, params);
      results[table] = rows;
      console.log(`  ✓ ${table}: ${rows.length} rows (${config.label})`);
    } catch (err) {
      console.error(`  ✗ ${table}: ${err.message}`);
      results[table] = [];
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = tables.length === 1
    ? `${tables[0]}-${env}-${timestamp}.json`
    : `multi-export-${env}-${timestamp}.json`;
  const filepath = path.join(exportDir, filename);

  fs.writeFileSync(filepath, JSON.stringify({
    exported_at: new Date().toISOString(),
    source_env: env,
    show_id: showId,
    tables: results,
    row_counts: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.length])),
  }, null, 2));

  const totalRows = Object.values(results).reduce((s, r) => s + r.length, 0);
  console.log(`\n✅ Exported ${totalRows} rows to: ${filepath}`);

  await pool.end();
  return filepath;
}

// ─── IMPORT ───────────────────────────────────────────────────────────────────

async function importData(opts) {
  const file = opts.file;
  if (!file) {
    console.error('Specify --file <path>');
    process.exit(1);
  }

  const filepath = path.resolve(file);
  if (!fs.existsSync(filepath)) {
    console.error(`File not found: ${filepath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const env = opts.env || 'production';
  const dryRun = opts.dry_run === true;
  const conflict = opts.conflict || 'skip'; // skip | update | replace
  const url = opts.target_url || getConnectionUrl(env);
  const pool = createPool(url);

  console.log(`\nImporting into ${env}${dryRun ? ' (DRY RUN)' : ''}...`);
  console.log(`Source: ${data.source_env} @ ${data.exported_at}`);
  console.log(`Conflict mode: ${conflict}`);

  for (const [table, rows] of Object.entries(data.tables)) {
    if (!rows || rows.length === 0) {
      console.log(`  ○ ${table}: 0 rows (skipping)`);
      continue;
    }

    console.log(`  → ${table}: ${rows.length} rows`);

    if (dryRun) {
      // Check which rows already exist
      const ids = rows.map(r => r.id).filter(Boolean);
      if (ids.length > 0) {
        try {
          const { rows: existing } = await pool.query(
            `SELECT id FROM ${table} WHERE id = ANY($1::uuid[])`,
            [ids]
          );
          const existingSet = new Set(existing.map(r => r.id));
          const newCount = ids.filter(id => !existingSet.has(id)).length;
          const existCount = ids.filter(id => existingSet.has(id)).length;
          console.log(`    Would insert: ${newCount} new, ${existCount} existing (${conflict})`);
        } catch (err) {
          console.log(`    Preview failed: ${err.message}`);
        }
      }
      continue;
    }

    // Actually import
    let inserted = 0, updated = 0, skipped = 0;

    for (const row of rows) {
      try {
        // Check if exists
        const { rows: existing } = await pool.query(
          `SELECT id FROM ${table} WHERE id = $1`,
          [row.id]
        );

        if (existing.length > 0) {
          if (conflict === 'skip') {
            skipped++;
            continue;
          }
          if (conflict === 'update') {
            // Update existing row with new data
            const cols = Object.keys(row).filter(k => k !== 'id' && k !== 'created_at');
            const sets = cols.map((c, i) => `"${c}" = $${i + 2}`);
            const vals = cols.map(c => row[c]);
            await pool.query(
              `UPDATE ${table} SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`,
              [row.id, ...vals]
            );
            updated++;
            continue;
          }
          if (conflict === 'replace') {
            await pool.query(`DELETE FROM ${table} WHERE id = $1`, [row.id]);
            // Fall through to insert
          }
        }

        // Insert
        const cols = Object.keys(row);
        const placeholders = cols.map((_, i) => `$${i + 1}`);
        const vals = cols.map(c => row[c]);
        await pool.query(
          `INSERT INTO ${table} (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')})`,
          vals
        );
        inserted++;
      } catch (err) {
        console.warn(`    ⚠ Row ${row.id}: ${err.message.slice(0, 100)}`);
        skipped++;
      }
    }

    console.log(`    ✓ inserted: ${inserted}, updated: ${updated}, skipped: ${skipped}`);
  }

  if (dryRun) {
    console.log('\n📋 Dry run complete. Run without --dry-run to apply.');
  } else {
    console.log('\n✅ Import complete.');
  }

  await pool.end();
}

// ─── SYNC (export + import in one step) ───────────────────────────────────────

async function syncData(opts) {
  const table = opts.table;
  const tables = opts.tables;
  const from = opts.from || 'dev';
  const to = opts.to || 'production';
  const showId = opts.show_id;
  const dryRun = opts.dry_run === true;
  const conflict = opts.conflict || 'skip';

  if (!table && !tables) {
    console.error('Specify --table <name> or --tables <name1,name2,...>');
    process.exit(1);
  }

  console.log(`\n🔄 Syncing ${table || tables}: ${from} → ${to}`);

  // Export
  const filepath = await exportData({
    table, tables, env: from, show_id: showId,
    source_url: opts.source_url,
  });

  // Import
  await importData({
    file: filepath, env: to, dry_run: dryRun, conflict,
    target_url: opts.target_url,
  });
}

// ─── LIST TABLES ──────────────────────────────────────────────────────────────

async function listTables(opts) {
  const env = opts.env || 'dev';
  const url = opts.source_url || getConnectionUrl(env);
  const pool = createPool(url);

  console.log(`\nTables in ${env}:\n`);

  for (const [table, config] of Object.entries(SYNCABLE_TABLES)) {
    try {
      const { rows } = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = parseInt(rows[0]?.count || 0);
      console.log(`  ${count > 0 ? '✓' : '○'} ${table.padEnd(25)} ${String(count).padStart(6)} rows  (${config.label})`);
    } catch {
      console.log(`  ✗ ${table.padEnd(25)}  (table missing)`);
    }
  }

  await pool.end();
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  switch (opts.command) {
    case 'export':
      await exportData(opts);
      break;
    case 'import':
      await importData(opts);
      break;
    case 'sync':
      await syncData(opts);
      break;
    case 'tables':
    case 'list':
      await listTables(opts);
      break;
    default:
      console.log(`
Data Sync — Cross-Environment Migration Tool

Commands:
  export   Export table data to JSON file
  import   Import JSON file into database
  sync     Export + import in one step
  tables   List available tables with row counts

Examples:
  # Export events from dev
  node scripts/data-sync.js export --table world_events --env dev --show-id UUID

  # Export multiple tables
  node scripts/data-sync.js export --tables world_events,wardrobe --env dev --show-id UUID

  # Import with dry run (preview)
  node scripts/data-sync.js import --file exports/world_events-dev-2026-04-05.json --env production --dry-run

  # Import for real (skip existing)
  node scripts/data-sync.js import --file exports/world_events-dev-2026-04-05.json --env production

  # Import and update existing rows
  node scripts/data-sync.js import --file exports/file.json --env production --conflict update

  # Direct sync: dev → production
  node scripts/data-sync.js sync --table world_events --from dev --to production --show-id UUID

  # List tables and row counts
  node scripts/data-sync.js tables --env dev

Options:
  --table <name>        Single table to export/sync
  --tables <a,b,c>      Multiple tables (comma-separated)
  --env <name>          Environment (uses DATABASE_URL_<ENV> from .env)
  --from <env>          Source environment (for sync)
  --to <env>            Target environment (for sync)
  --show-id <uuid>      Filter by show ID
  --dry-run             Preview without making changes
  --conflict <mode>     How to handle existing rows: skip (default), update, replace
  --source-url <url>    Override source database URL
  --target-url <url>    Override target database URL
  --file <path>         JSON file to import

Environment setup:
  Add to .env:
    DATABASE_URL_DEV=postgresql://...
    DATABASE_URL_PRODUCTION=postgresql://...
    DATABASE_URL_STAGING=postgresql://...
`);
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
