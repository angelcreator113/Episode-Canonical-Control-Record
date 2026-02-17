#!/usr/bin/env node
/**
 * Bootstrap SequelizeMeta table for databases created by sequelize.sync()
 * 
 * Problem: The RDS database was originally set up via sequelize.sync(), which
 * creates tables matching the current model but does NOT create SequelizeMeta.
 * When sequelize-cli db:migrate runs, it thinks no migrations have been applied
 * and tries to re-run everything, causing errors on the existing schema.
 * 
 * Solution: If the database has tables but SequelizeMeta is empty, seed it
 * with all known migration filenames so only truly new migrations will run.
 * 
 * Usage: node scripts/bootstrap-sequelize-meta.js
 * Requires: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD env vars
 */

const { Sequelize } = require('sequelize');

// All migration files that were "baked in" by sequelize.sync()
// These match the current schema and should be marked as already-applied
const KNOWN_MIGRATIONS = [
  '20240101000001-create-episodes.js',
  '20240101000002-create-metadata-storage.js',
  '20240101000003-create-thumbnails.js',
  '20240101000004-create-processing-queue.js',
  '20240101000005-create-activity-logs.js',
  '20240101000006-create-scenes.js',
  '20240101000007-create-episode-scripts.js',
  '20240101000008-create-script-metadata.js',
  '20260106000001-add-categories-to-episodes.js',
  '20260108183816-update-assets-table.js',
  '20260108184514-update-assets-table.js',
  '20260108185054-update-assets-table.js',
  '20260108200000-create-episode-templates.js',
  '20260109132556-create-shows.js',
  '20260110000000-create-assets.js',
  '20260115000000-create-scene-library.js',
  '20260118000000-add-scene-thumbnail-assets.js',
  '20260120000000-create-episode-scenes.js',
  '20260124000000-add-clip-sequence-fields.js',
  '20260125000000-create-thumbnail-compositions.js',
  '20260127000001-add-thumbnail-compositions-deleted-at.js',
  '20260206000001-add-timestamps-to-episodes.js',
  '20260206000002-add-current-ai-edit-plan-id.js',
  '20260206000003-make-show-name-nullable.js',
  '20260206000004-make-legacy-dates-nullable.js',
  '20260206000005-add-missing-scene-columns.js',
  '20260206000006-add-remaining-scene-columns.js',
  '20260206000007-add-thumbnail-url-metadata.js',
  '20260206-add-scene-footage-links.js',
  '20260207064025-add-decision-logging-tables.js',
  '20260208000000-create-lala-formula.js',
  '20260208000001-add-game-show-features.js',
  '20260208000002-create-lala-formula.js',
  '20260208102717-add-asset-categories.js',
  '20260208110000-add-clip-timing-to-layer-assets.js',
  '20260208110001-create-decision-logs-table.js',
  '20260208-add-upload-tracking.js',
  '20260208-create-edit-maps.js',
  '20260209000001-scene-composer-phase1.js',
  '20260209070000-fix-thumbnail-episodeid-type.js',
  '20260209080000-fix-scenes-thumbnail-id-type.js',
  '20260214100000-add-platform-and-timeline-data.js',
  '20260214200000-add-timeline-keyframes.js',
  '20260215000000-add-scene-background-url.js',
  '20260216000001-asset-wardrobe-system.js',
  '20260217000001-add-script-content-to-episodes.js',
];

async function bootstrap() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'episode_metadata',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    dialect: 'postgres',
    logging: false,
    dialectOptions: process.env.DB_SSL === 'true' ? {
      ssl: { require: true, rejectUnauthorized: false }
    } : {},
  };

  const sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    dbConfig
  );

  try {
    await sequelize.authenticate();
    console.log('Connected to database');

    // Create SequelizeMeta if it doesn't exist
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
        "name" VARCHAR(255) NOT NULL UNIQUE PRIMARY KEY
      )
    `);

    // Check current state
    const [metaRows] = await sequelize.query('SELECT COUNT(*) as count FROM "SequelizeMeta"');
    const metaCount = parseInt(metaRows[0].count);

    const [tableRows] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'episodes'
    `);
    const hasEpisodes = parseInt(tableRows[0].count) > 0;

    console.log(`SequelizeMeta entries: ${metaCount}, episodes table exists: ${hasEpisodes}`);

    if (metaCount === 0 && hasEpisodes) {
      console.log('Database was bootstrapped outside migrations. Seeding SequelizeMeta...');
      
      let seeded = 0;
      for (const name of KNOWN_MIGRATIONS) {
        try {
          await sequelize.query(
            'INSERT INTO "SequelizeMeta" ("name") VALUES ($1) ON CONFLICT DO NOTHING',
            { bind: [name] }
          );
          seeded++;
        } catch (err) {
          console.warn(`  Warning: could not seed ${name}: ${err.message}`);
        }
      }
      
      console.log(`Seeded ${seeded}/${KNOWN_MIGRATIONS.length} migration entries`);
    } else if (metaCount > 0) {
      console.log('SequelizeMeta already has entries — no bootstrap needed');
    } else {
      console.log('Fresh database — migrations will create tables from scratch');
    }

  } catch (err) {
    console.error('Bootstrap error:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

bootstrap();
