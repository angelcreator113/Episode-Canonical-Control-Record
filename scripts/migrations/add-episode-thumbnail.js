/**
 * Migration: Add thumbnail_url to episodes table
 * Allows episodes to have a cover/thumbnail image (typically from primary composition)
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

async function addEpisodeThumbnail() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Add thumbnail_url column to episodes table
    console.log('\n📝 Adding thumbnail_url to episodes table...');
    await sequelize.query(`
      ALTER TABLE episodes 
      ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(1024);
    `);
    console.log('✅ Added thumbnail_url column');

    // Add comment
    await sequelize.query(`
      COMMENT ON COLUMN episodes.thumbnail_url IS 'URL to episode cover image, typically from primary composition';
    `);
    console.log('✅ Added column comment');

    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addEpisodeThumbnail();
