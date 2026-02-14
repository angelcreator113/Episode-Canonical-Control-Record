/**
 * Add is_primary field to thumbnail_compositions table
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'episode_metadata_dev',
  logging: false,
  dialectOptions: {
    ssl: {
      require: false,
      rejectUnauthorized: false,
    },
  },
});

async function addIsPrimaryField() {
  try {
    console.log('🔄 Adding is_primary field to thumbnail_compositions...');

    await sequelize.query(`
      ALTER TABLE thumbnail_compositions
      ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
    `);
    
    console.log('✅ is_primary field added');

    // Create index for finding primary compositions
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_tc_episode_primary
      ON thumbnail_compositions(episode_id, is_primary)
      WHERE is_primary = true;
    `);

    console.log('✅ Index created for primary compositions');
    console.log('\n✨ Database ready for primary thumbnail tracking');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addIsPrimaryField();
