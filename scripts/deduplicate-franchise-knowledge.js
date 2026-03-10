#!/usr/bin/env node
'use strict';

/**
 * Standalone script to deduplicate franchise_knowledge entries.
 *
 * Usage:  node scripts/deduplicate-franchise-knowledge.js
 *
 * This does NOT go through SequelizeMeta — it runs directly against the DB.
 * Safe to run multiple times (idempotent: only touches rows where deleted_at IS NULL).
 */

require('dotenv').config();

const { Sequelize } = require('sequelize');

// ── Build connection from env (same logic as src/config/sequelize.js) ────────
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not set in environment / .env');
  process.exit(1);
}

const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: process.env.DB_SSL === 'true'
      ? { require: true, rejectUnauthorized: false }
      : false,
  },
});

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database.\n');

    // ── Show before-state ──────────────────────────────────────────────────
    const [before] = await sequelize.query(`
      SELECT COUNT(*) AS total FROM franchise_knowledge WHERE deleted_at IS NULL;
    `);
    console.log(`Entries before dedup: ${before[0].total}`);

    // ── Find & show duplicates (dry-run preview) ───────────────────────────
    const [dupes] = await sequelize.query(`
      SELECT LOWER(TRIM(title)) AS norm_title, COUNT(*) AS cnt
      FROM franchise_knowledge
      WHERE deleted_at IS NULL
      GROUP BY LOWER(TRIM(title))
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC, norm_title;
    `);

    if (dupes.length === 0) {
      console.log('\nNo duplicates found. Nothing to do.');
      await sequelize.close();
      return;
    }

    console.log(`\nFound ${dupes.length} duplicate group(s):`);
    for (const d of dupes) {
      console.log(`  "${d.norm_title}" — ${d.cnt} copies`);
    }

    // ── Soft-delete losers ─────────────────────────────────────────────────
    const [results] = await sequelize.query(`
      WITH ranked AS (
        SELECT
          id,
          title,
          LOWER(TRIM(title)) AS norm_title,
          extracted_by,
          source_document,
          always_inject,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(title))
            ORDER BY
              -- Tier: franchise_bible / system source wins
              CASE
                WHEN source_document ILIKE '%franchise_bible%' THEN 0
                WHEN extracted_by = 'system'                   THEN 0
                WHEN extracted_by = 'direct_entry'             THEN 1
                WHEN extracted_by = 'conversation_extraction'  THEN 2
                WHEN extracted_by = 'document_ingestion'       THEN 3
                ELSE 4
              END,
              -- Tiebreaker 1: always_inject = true wins
              CASE WHEN always_inject = true THEN 0 ELSE 1 END,
              -- Tiebreaker 2: active status wins
              CASE status
                WHEN 'active'         THEN 0
                WHEN 'pending_review' THEN 1
                WHEN 'superseded'     THEN 2
                WHEN 'archived'       THEN 3
                ELSE 4
              END,
              -- Tiebreaker 3: higher id (newer) wins
              id DESC
          ) AS rn
        FROM franchise_knowledge
        WHERE deleted_at IS NULL
      ),
      keepers AS (
        SELECT norm_title, id AS keeper_id
        FROM ranked
        WHERE rn = 1
      ),
      losers AS (
        SELECT r.id AS loser_id, r.title, r.extracted_by, r.source_document,
               k.keeper_id
        FROM ranked r
        JOIN keepers k ON k.norm_title = r.norm_title
        WHERE r.rn > 1
      ),
      do_update AS (
        UPDATE franchise_knowledge fk
        SET
          deleted_at    = NOW(),
          status        = 'superseded',
          superseded_by = l.keeper_id,
          review_note   = COALESCE(review_note || '; ', '') ||
                          'Auto-deduplicated: duplicate title, kept id=' || l.keeper_id
        FROM losers l
        WHERE fk.id = l.loser_id
        RETURNING fk.id, fk.title, l.keeper_id
      )
      SELECT * FROM do_update ORDER BY id;
    `);

    console.log(`\nRemoved ${results.length} duplicate(s):`);
    for (const r of results) {
      console.log(`  id=${r.id} "${r.title}" → superseded by id=${r.keeper_id}`);
    }

    // ── Show after-state ───────────────────────────────────────────────────
    const [after] = await sequelize.query(`
      SELECT COUNT(*) AS total FROM franchise_knowledge WHERE deleted_at IS NULL;
    `);
    console.log(`\nEntries remaining: ${after[0].total}`);
    console.log('Done.');

    await sequelize.close();
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

run();
