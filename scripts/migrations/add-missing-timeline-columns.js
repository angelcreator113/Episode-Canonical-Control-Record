const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'episode_metadata',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log,
  }
);

async function addMissingColumns() {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected\n');

    // Add missing columns to episode_assets
    console.log('📦 Adding missing columns to episode_assets...');
    
    await sequelize.query(`
      ALTER TABLE episode_assets 
      ADD COLUMN IF NOT EXISTS folder VARCHAR(100),
      ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tags TEXT[],
      ADD COLUMN IF NOT EXISTS added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS added_by VARCHAR(100);
    `);
    
    console.log('✅ episode_assets columns added\n');

    // Add missing columns to timeline_placements
    console.log('📦 Adding missing columns to timeline_placements...');
    
    await sequelize.query(`
      ALTER TABLE timeline_placements 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
    `);
    
    console.log('✅ timeline_placements columns added\n');

    console.log('✅ All columns added successfully!');
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addMissingColumns();
