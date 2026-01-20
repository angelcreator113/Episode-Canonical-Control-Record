/**
 * Run migration: Add show_id to episodes table
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL || process.env.DB_NAME, {
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

async function runMigration() {
  try {
    console.log('🔄 Running migration: Add show_id to episodes...');

    // Add show_id column without foreign key constraint for now
    await sequelize.query(`
      ALTER TABLE episodes 
      ADD COLUMN IF NOT EXISTS show_id UUID;
    `);

    console.log('✅ Added show_id column');

    // Add index
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_episodes_show_id ON episodes(show_id);
    `);

    console.log('✅ Added index on show_id');
    console.log('✅ Migration completed successfully!');
    console.log('ℹ️  Note: Foreign key constraint can be added later when shows table is ready');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
