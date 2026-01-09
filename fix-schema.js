#!/usr/bin/env node

const { Sequelize } = require('sequelize');
require('dotenv').config();

async function fixSchema() {
  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    logging: false,
  });

  try {
    console.log('🔧 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected');

    console.log('🔧 Fixing thumbnail_compositions schema...');

    // Drop foreign key if exists
    await sequelize.query(`
      ALTER TABLE thumbnail_compositions 
      DROP CONSTRAINT IF EXISTS "thumbnail_compositions_episode_id_fkey"
    `);
    console.log('  ✅ Dropped old FK');

    // Fix episode_id type
    await sequelize.query(`
      ALTER TABLE thumbnail_compositions 
      ALTER COLUMN episode_id TYPE INTEGER USING NULL
    `);
    console.log('  ✅ Changed episode_id to INTEGER');

    // Re-add FK
    await sequelize.query(`
      ALTER TABLE thumbnail_compositions
      ADD CONSTRAINT "thumbnail_compositions_episode_id_fkey" 
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL
    `);
    console.log('  ✅ Re-added FK constraint');

    // Fix thumbnail_id
    await sequelize.query(`
      ALTER TABLE thumbnail_compositions 
      ALTER COLUMN thumbnail_id TYPE INTEGER USING NULL,
      ALTER COLUMN thumbnail_id DROP NOT NULL
    `);
    console.log('  ✅ Changed thumbnail_id to INTEGER and nullable');

    console.log('✅ Schema fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixSchema();
