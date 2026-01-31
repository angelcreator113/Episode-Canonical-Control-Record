/**
 * Run file_hash migration manually
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

// Create Sequelize instance
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

async function runMigration() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected');

    const transaction = await sequelize.transaction();

    try {
      console.log('📝 Adding file_hash column to assets table...');

      // Add file_hash column
      await sequelize.query(
        `ALTER TABLE assets ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);`,
        { transaction }
      );

      // Add index for fast duplicate lookups
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_assets_file_hash 
         ON assets(file_hash) 
         WHERE file_hash IS NOT NULL AND deleted_at IS NULL;`,
        { transaction }
      );

      // Add composite index for hash + deleted_at
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_assets_file_hash_deleted 
         ON assets(file_hash, deleted_at);`,
        { transaction }
      );

      console.log('✅ file_hash column added successfully');

      await transaction.commit();
      console.log('✅ Migration complete');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

runMigration()
  .then(() => {
    console.log('🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error:', error);
    process.exit(1);
  });
