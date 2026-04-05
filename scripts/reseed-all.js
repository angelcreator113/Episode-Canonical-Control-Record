#!/usr/bin/env node
'use strict';

/**
 * Master Re-Seed Script
 * ─────────────────────────────────────────────────────────────
 * Restores all canon data from Sequelize seeders + creates the
 * core "Styling Adventures with Lala" show and starter episodes.
 *
 * Usage:
 *   # Using DATABASE_URL from .env
 *   node scripts/reseed-all.js
 *
 *   # Or with explicit connection string
 *   DATABASE_URL="postgresql://..." node scripts/reseed-all.js
 *
 * What it restores:
 *   1. Core show ("Styling Adventures with Lala")
 *   2. Starter episodes (Season 1, Eps 1-5)
 *   3. Episode templates
 *   4. Franchise knowledge / Show Brain (10 seeder files)
 *   5. JustAWoman's social profile
 *   6. 9 core world characters
 *   7. Cultural calendar (24 events + 13 micro + 5 icons)
 *
 * Safe to re-run: skips tables that already have data.
 */

const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '../.env') }); } catch {}

// ─── DB SETUP ────────────────────────────────────────────────────────────────

const { Sequelize, DataTypes } = require('sequelize');

const dbUrl = process.env.DATABASE_URL;
const sequelizeOpts = {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: (process.env.DB_SSL !== 'false')
      ? { rejectUnauthorized: false }
      : false,
  },
};

let sequelize;
if (dbUrl) {
  sequelize = new Sequelize(dbUrl, sequelizeOpts);
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'neondb',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || '',
    {
      ...sequelizeOpts,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
    }
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function tableCount(table) {
  try {
    const [[r]] = await sequelize.query(`SELECT COUNT(*) as c FROM "${table}"`);
    return parseInt(r.c);
  } catch {
    return -1; // table doesn't exist
  }
}

async function runSeeder(name, seederPath) {
  try {
    const seeder = require(seederPath);
    // Sequelize seeders use queryInterface
    const qi = sequelize.getQueryInterface();
    await seeder.up(qi, Sequelize);
    console.log(`  ✅ ${name}`);
    return true;
  } catch (err) {
    if (err.message && err.message.includes('already')) {
      console.log(`  ⏭️  ${name} (already seeded)`);
      return true;
    }
    console.error(`  ❌ ${name}: ${err.message}`);
    return false;
  }
}

// ─── STEP 1: CORE SHOW ──────────────────────────────────────────────────────

async function seedCoreShow() {
  console.log('\n📺 Step 1: Core Show');

  const count = await tableCount('shows');
  if (count > 0) {
    console.log(`  ⏭️  Shows table already has ${count} rows — skipping`);
    return null;
  }
  if (count === -1) {
    console.error('  ❌ Shows table does not exist. Run migrations first.');
    return null;
  }

  const { v4: uuidv4 } = require('uuid');
  const showId = uuidv4();
  const now = new Date();

  await sequelize.query(`
    INSERT INTO shows (id, name, slug, description, genre, status, is_active, creator_name, network,
                       season_count, episode_count, icon, color, created_at, updated_at)
    VALUES (:id, :name, :slug, :description, :genre, :status, :is_active, :creator_name, :network,
            :season_count, :episode_count, :icon, :color, :created_at, :updated_at)
  `, {
    replacements: {
      id: showId,
      name: 'Styling Adventures with Lala',
      slug: 'styling-adventures-with-lala',
      description: 'A narrative-driven luxury fashion life simulator. Fashion is strategy. Reputation is currency. Legacy is built episode by episode.',
      genre: 'Drama,Fashion,Life Simulation',
      status: 'active',
      is_active: true,
      creator_name: 'Prime Studios',
      network: 'YouTube',
      season_count: 1,
      episode_count: 5,
      icon: '👗',
      color: '#B8962E',
      created_at: now,
      updated_at: now,
    },
  });

  console.log(`  ✅ Created "Styling Adventures with Lala" (ID: ${showId})`);
  return showId;
}

// ─── STEP 2: STARTER EPISODES ────────────────────────────────────────────────

async function seedStarterEpisodes(showId) {
  console.log('\n🎬 Step 2: Starter Episodes');

  const count = await tableCount('episodes');
  if (count > 0) {
    console.log(`  ⏭️  Episodes table already has ${count} rows — skipping`);
    return;
  }

  if (!showId) {
    // Try to find existing show
    const [[show]] = await sequelize.query(
      `SELECT id FROM shows WHERE slug = 'styling-adventures-with-lala' AND deleted_at IS NULL LIMIT 1`
    );
    if (!show) {
      console.log('  ⏭️  No show found — skipping episodes');
      return;
    }
    showId = show.id;
  }

  const { v4: uuidv4 } = require('uuid');
  const now = new Date();

  const episodes = [
    { num: 1, title: 'The New Beginning', summary: 'Lala starts her new role and discovers unexpected challenges in the fashion world.', director: 'Maria Santos', writer: 'Jessica Chen', date: '2025-01-15' },
    { num: 2, title: 'Finding Her Voice', summary: 'Lala learns to stand up for herself and define her creative vision.', director: 'Maria Santos', writer: 'Jessica Chen', date: '2025-01-22' },
    { num: 3, title: 'Unexpected Allies', summary: 'A guest star joins the cast and creates surprising alliances in Lala\'s world.', director: 'James Mitchell', writer: 'Alexandra Brown', date: '2025-01-29' },
    { num: 4, title: 'The Guest Episode', summary: 'A special guest appearance brings new dynamics and shifts power balances.', director: 'Maria Santos', writer: 'Jessica Chen', date: '2025-02-05' },
    { num: 5, title: 'Rising to the Challenge', summary: 'Lala faces her biggest professional challenge yet — and discovers what she\'s made of.', director: 'James Mitchell', writer: 'Alexandra Brown', date: '2025-02-12' },
  ];

  for (const ep of episodes) {
    await sequelize.query(`
      INSERT INTO episodes (id, show_id, show_name, season_number, episode_number, episode_title,
                           air_date, plot_summary, director, writer, duration_minutes, rating, genre,
                           created_at, updated_at)
      VALUES (:id, :show_id, :show_name, :season_number, :episode_number, :episode_title,
              :air_date, :plot_summary, :director, :writer, :duration_minutes, :rating, :genre,
              :created_at, :updated_at)
    `, {
      replacements: {
        id: uuidv4(),
        show_id: showId,
        show_name: 'Styling Adventures with Lala',
        season_number: 1,
        episode_number: ep.num,
        episode_title: ep.title,
        air_date: new Date(ep.date),
        plot_summary: ep.summary,
        director: ep.director,
        writer: ep.writer,
        duration_minutes: 45,
        rating: 'PG-13',
        genre: 'Drama,Comedy',
        created_at: now,
        updated_at: now,
      },
    });
    console.log(`  ✅ S01E${String(ep.num).padStart(2, '0')}: "${ep.title}"`);
  }
}

// ─── STEP 3: EPISODE TEMPLATES ───────────────────────────────────────────────

async function seedTemplates() {
  console.log('\n📋 Step 3: Episode Templates');
  const count = await tableCount('episode_templates');
  if (count > 0) {
    console.log(`  ⏭️  Episode templates already have ${count} rows — skipping`);
    return;
  }
  await runSeeder('Episode templates', path.join(__dirname, '../src/seeders/20260108210000-seed-episode-templates.js'));
}

// ─── STEP 4: FRANCHISE KNOWLEDGE (SHOW BRAIN) ───────────────────────────────

async function seedFranchiseKnowledge() {
  console.log('\n🧠 Step 4: Franchise Knowledge / Show Brain');
  const count = await tableCount('franchise_knowledge');
  if (count > 0) {
    console.log(`  ⏭️  Franchise knowledge already has ${count} rows — skipping`);
    return;
  }

  const seeders = [
    ['Cultural systems', '20260312000000-cultural-system-franchise-laws.js'],
    ['Influencer systems', '20260312100000-influencer-systems-franchise-laws.js'],
    ['World infrastructure', '20260312200000-world-infrastructure-franchise-laws.js'],
    ['Social timeline', '20260312300000-social-timeline-franchise-laws.js'],
    ['Social personality', '20260312400000-social-personality-franchise-laws.js'],
    ['Character life simulation', '20260312500000-character-life-simulation-franchise-laws.js'],
    ['Cultural memory', '20260312600000-cultural-memory-franchise-laws.js'],
    ['Character depth engine', '20260312700000-character-depth-engine-franchise-laws.js'],
    ['Show Brain (master)', '20260312800000-show-brain-franchise-laws.js'],
    ['Embodied life rules', '20260312900000-embodied-life-rules-franchise-laws.js'],
  ];

  for (const [name, file] of seeders) {
    await runSeeder(name, path.join(__dirname, '../src/seeders', file));
  }
}

// ─── STEP 5: JUSTAWOMAN PROFILE ─────────────────────────────────────────────

async function seedJustAWomanProfile() {
  console.log('\n👤 Step 5: JustAWoman Social Profile');

  // Check if social_profiles table exists and has the record
  try {
    const [[r]] = await sequelize.query(
      `SELECT COUNT(*) as c FROM social_profiles WHERE is_justawoman_record = true`
    );
    if (parseInt(r.c) > 0) {
      console.log('  ⏭️  JustAWoman profile already exists — skipping');
      return;
    }
  } catch {
    console.log('  ⏭️  social_profiles table not found — skipping');
    return;
  }

  await runSeeder('JustAWoman profile', path.join(__dirname, '../src/seeders/20260314100000-justawoman-lalaverse-profile.js'));
}

// ─── STEP 6: WORLD CHARACTERS ────────────────────────────────────────────────

async function seedWorldCharacters() {
  console.log('\n👥 Step 6: World Characters (9 core)');

  const count = await tableCount('registry_characters');
  if (count === -1) {
    console.log('  ⏭️  registry_characters table not found — skipping');
    return;
  }
  if (count > 0) {
    console.log(`  ⏭️  Registry characters already has ${count} rows — skipping`);
    return;
  }

  await runSeeder('World characters', path.join(__dirname, '../src/seeders/20260316200000-justawoman-world-characters.js'));
}

// ─── STEP 7: CULTURAL CALENDAR ───────────────────────────────────────────────

async function seedCulturalCalendar() {
  console.log('\n📅 Step 7: Cultural Calendar');

  // This seeder targets story_calendar_events
  const count = await tableCount('story_calendar_events');
  if (count === -1) {
    // May also use world_events
    const weCount = await tableCount('world_events');
    if (weCount === -1) {
      console.log('  ⏭️  Calendar table not found — skipping');
      return;
    }
    if (weCount > 0) {
      console.log(`  ⏭️  World events already has ${weCount} rows — skipping`);
      return;
    }
  } else if (count > 0) {
    console.log(`  ⏭️  Calendar events already has ${count} rows — skipping`);
    return;
  }

  await runSeeder('Cultural calendar', path.join(__dirname, '../src/seeders/lalaverse-cultural-calendar.js'));
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          MASTER RE-SEED — LalaVerse Data Recovery       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  try {
    await sequelize.authenticate();
    const [[info]] = await sequelize.query("SELECT current_database() as db");
    console.log(`\n🔌 Connected to: ${info.db}`);
  } catch (err) {
    console.error(`\n❌ Cannot connect to database: ${err.message}`);
    process.exit(1);
  }

  let showId = null;
  let success = 0;
  let total = 7;

  try { showId = await seedCoreShow(); success++; } catch (e) { console.error('  ❌ Show seed failed:', e.message); }
  try { await seedStarterEpisodes(showId); success++; } catch (e) { console.error('  ❌ Episode seed failed:', e.message); }
  try { await seedTemplates(); success++; } catch (e) { console.error('  ❌ Template seed failed:', e.message); }
  try { await seedFranchiseKnowledge(); success++; } catch (e) { console.error('  ❌ Franchise knowledge failed:', e.message); }
  try { await seedJustAWomanProfile(); success++; } catch (e) { console.error('  ❌ JustAWoman profile failed:', e.message); }
  try { await seedWorldCharacters(); success++; } catch (e) { console.error('  ❌ World characters failed:', e.message); }
  try { await seedCulturalCalendar(); success++; } catch (e) { console.error('  ❌ Cultural calendar failed:', e.message); }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`✨ Re-seed complete: ${success}/${total} steps succeeded`);
  console.log('══════════════════════════════════════════════════════════\n');

  await sequelize.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
