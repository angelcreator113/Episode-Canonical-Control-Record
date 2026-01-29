/**
 * Migration: Add is_primary to thumbnail_compositions table
 * Allows marking one composition per episode as the primary/canonical one
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: console.log,
  }
);

async function addIsPrimary() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Add is_primary column to thumbnail_compositions table
    console.log('\n📝 Adding is_primary to thumbnail_compositions table...');
    await sequelize.query(`
      ALTER TABLE thumbnail_compositions 
      ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;
    `);
    console.log('✅ Added is_primary column');

    // Add unique constraint to ensure only one primary composition per episode
    console.log('\n📝 Adding unique constraint for primary compositions...');
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_primary_composition_per_episode 
      ON thumbnail_compositions (episode_id) 
      WHERE is_primary = TRUE;
    `);
    console.log('✅ Added unique constraint (partial index)');

    // Add comment
    await sequelize.query(`
      COMMENT ON COLUMN thumbnail_compositions.is_primary IS 'Whether this is the primary/canonical composition for the episode';
    `);
    console.log('✅ Added column comment');

    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addIsPrimary();
