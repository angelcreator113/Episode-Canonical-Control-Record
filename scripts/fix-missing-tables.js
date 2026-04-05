#!/usr/bin/env node
/**
 * Fix missing tables after DB_SYNC_FORCE incident
 * Creates tables that may have been dropped but migration says already exists
 */
require('dotenv').config();
const { Sequelize } = require('sequelize');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sequelize = new Sequelize(DATABASE_URL, {
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
});

async function tableExists(name) {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
    { bind: [name] }
  );
  return rows.length > 0;
}

async function run() {
  console.log('🔧 Checking for missing tables and columns...\n');

  // ─── Fix scene_sets missing columns ────────────────────────────────────
  const sceneSetCols = [
    ['base_still_url', 'TEXT'],
    ['style_reference_url', 'TEXT'],
    ['negative_prompt', 'TEXT'],
    ['variation_count', 'INTEGER DEFAULT 1'],
    ['cover_angle_id', 'UUID'],
    ['canvas_settings', 'JSONB'],
    ['world_location_id', 'UUID'],
  ];
  
  for (const [col, type] of sceneSetCols) {
    try {
      await sequelize.query(`ALTER TABLE scene_sets ADD COLUMN IF NOT EXISTS ${col} ${type}`);
      console.log(`  scene_sets.${col}: ✓`);
    } catch (e) {
      if (!e.message.includes('already exists')) {
        console.log(`  scene_sets.${col}: ${e.message}`);
      }
    }
  }

  // ─── Fix scene_angles missing columns ──────────────────────────────────
  const sceneAngleCols = [
    ['angle_description', 'TEXT'],
    ['camera_direction', 'TEXT'],
    ['beat_affinity', 'JSONB DEFAULT \'[]\''],
    ['mood', 'VARCHAR(255)'],
    ['runway_prompt', 'TEXT'],
    ['runway_seed', 'VARCHAR(255)'],
    ['runway_job_id', 'VARCHAR(255)'],
    ['still_image_url', 'TEXT'],
    ['video_clip_url', 'TEXT'],
    ['thumbnail_url', 'TEXT'],
    ['quality_score', 'INTEGER'],
    ['artifact_flags', 'JSONB DEFAULT \'[]\''],
    ['quality_review', 'JSONB'],
    ['generation_attempt', 'INTEGER DEFAULT 1'],
    ['refined_prompt', 'TEXT'],
    ['camera_motion', 'VARCHAR(255)'],
    ['video_duration', 'INTEGER DEFAULT 5'],
    ['style_reference_url', 'TEXT'],
    ['variation_count', 'INTEGER DEFAULT 1'],
    ['variation_data', 'JSONB'],
    ['enhanced_still_url', 'TEXT'],
    ['enhanced_video_url', 'TEXT'],
    ['depth_map_url', 'TEXT'],
    ['control_value', 'INTEGER'],
    ['vulnerability_value', 'INTEGER'],
    ['sort_order', 'INTEGER DEFAULT 0'],
  ];
  
  for (const [col, type] of sceneAngleCols) {
    try {
      await sequelize.query(`ALTER TABLE scene_angles ADD COLUMN IF NOT EXISTS ${col} ${type}`);
      console.log(`  scene_angles.${col}: ✓`);
    } catch (e) {
      if (!e.message.includes('already exists')) {
        console.log(`  scene_angles.${col}: ${e.message}`);
      }
    }
  }

  // ─── Fix scene_angles enum columns ─────────────────────────────────────
  // generation_status enum
  try {
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE scene_angle_gen_status AS ENUM ('pending', 'generating', 'complete', 'failed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await sequelize.query(`ALTER TABLE scene_angles ADD COLUMN IF NOT EXISTS generation_status scene_angle_gen_status DEFAULT 'pending'`);
    console.log('  scene_angles.generation_status: ✓');
  } catch (e) {
    if (!e.message.includes('already exists')) console.log(`  scene_angles.generation_status: ${e.message}`);
  }

  // post_processing_status enum
  try {
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE scene_angle_pp_status AS ENUM ('pending', 'processing', 'complete', 'failed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await sequelize.query(`ALTER TABLE scene_angles ADD COLUMN IF NOT EXISTS post_processing_status scene_angle_pp_status DEFAULT 'pending'`);
    console.log('  scene_angles.post_processing_status: ✓');
  } catch (e) {
    if (!e.message.includes('already exists')) console.log(`  scene_angles.post_processing_status: ${e.message}`);
  }

  // depth_status enum
  try {
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE scene_angle_depth_status AS ENUM ('pending', 'generating', 'complete', 'failed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await sequelize.query(`ALTER TABLE scene_angles ADD COLUMN IF NOT EXISTS depth_status scene_angle_depth_status`);
    console.log('  scene_angles.depth_status: ✓');
  } catch (e) {
    if (!e.message.includes('already exists')) console.log(`  scene_angles.depth_status: ${e.message}`);
  }

  // Check and create scene_set_episodes
  if (!(await tableExists('scene_set_episodes'))) {
    console.log('Creating scene_set_episodes...');
    await sequelize.query(`
      CREATE TABLE scene_set_episodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scene_set_id UUID NOT NULL REFERENCES scene_sets(id) ON DELETE CASCADE,
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await sequelize.query(`
      CREATE UNIQUE INDEX scene_set_episodes_unique_pair 
      ON scene_set_episodes(scene_set_id, episode_id) 
      WHERE deleted_at IS NULL
    `);
    console.log('✅ scene_set_episodes created');
  } else {
    console.log('✅ scene_set_episodes already exists');
  }

  // Check and create episode_briefs
  if (!(await tableExists('episode_briefs'))) {
    console.log('Creating episode_briefs...');
    await sequelize.query(`
      CREATE TABLE episode_briefs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        brief_type VARCHAR(50) NOT NULL DEFAULT 'standard',
        title VARCHAR(255),
        content TEXT,
        status VARCHAR(50) DEFAULT 'draft',
        ai_generated BOOLEAN DEFAULT false,
        extra_fields JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    console.log('✅ episode_briefs created');
  } else {
    console.log('✅ episode_briefs already exists');
  }

  // Check and create scene_plans
  if (!(await tableExists('scene_plans'))) {
    console.log('Creating scene_plans...');
    await sequelize.query(`
      CREATE TABLE scene_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_brief_id UUID REFERENCES episode_briefs(id) ON DELETE SET NULL,
        episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL,
        scene_number INTEGER,
        title VARCHAR(255),
        description TEXT,
        location VARCHAR(255),
        time_of_day VARCHAR(50),
        characters JSONB DEFAULT '[]',
        beats JSONB DEFAULT '[]',
        emotional_arc TEXT,
        status VARCHAR(50) DEFAULT 'planned',
        extra_fields JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    console.log('✅ scene_plans created');
  } else {
    console.log('✅ scene_plans already exists');
  }

  // Check and create episode_todo_lists
  if (!(await tableExists('episode_todo_lists'))) {
    console.log('Creating episode_todo_lists...');
    await sequelize.query(`
      CREATE TABLE episode_todo_lists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        items JSONB DEFAULT '[]',
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    console.log('✅ episode_todo_lists created');
  } else {
    console.log('✅ episode_todo_lists already exists');
  }

  console.log('\n✨ Table check complete');
  await sequelize.close();
}

run().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
