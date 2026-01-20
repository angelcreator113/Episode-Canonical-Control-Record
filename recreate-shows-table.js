#!/usr/bin/env node
/**
 * Drop and Recreate Shows Table with correct columns
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
});

async function recreateShowsTable() {
  try {
    console.log('🔄 Dropping existing shows table...');
    await sequelize.query(`DROP TABLE IF EXISTS "shows" CASCADE;`);
    console.log('✅ Shows table dropped!');
    
    console.log('🔄 Creating Shows table with all required columns...');
    
    const query = `
      CREATE TABLE IF NOT EXISTS "shows" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(255) NOT NULL UNIQUE,
        "slug" VARCHAR(255) NOT NULL UNIQUE,
        "description" TEXT,
        "genre" VARCHAR(255),
        "status" VARCHAR(50) DEFAULT 'active',
        "creator_name" VARCHAR(255),
        "network" VARCHAR(255),
        "episode_count" INTEGER DEFAULT 0,
        "season_count" INTEGER DEFAULT 1,
        "premiere_date" TIMESTAMP,
        "metadata" JSONB DEFAULT '{}',
        "is_active" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMP
      );
    `;
    
    await sequelize.query(query);
    console.log('✅ Shows table created successfully!');
    
    // Create indexes
    console.log('🔄 Creating indexes...');
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_shows_slug ON shows(slug);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_shows_status ON shows(status);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_shows_is_active ON shows(is_active);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_shows_deleted_at ON shows(deleted_at);`);
    console.log('✅ Indexes created!');
    
  } catch (error) {
    console.error('❌ Error recreating shows table:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

recreateShowsTable()
  .then(() => {
    console.log('✅ Shows table setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  });
