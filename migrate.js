#!/usr/bin/env node

/**
 * Database Migration Runner
 * Executes Sequelize migrations against PostgreSQL
 */

require('dotenv').config();

const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

// Configuration from environment
const config = {
  database: process.env.DB_NAME || 'episode_metadata',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  logging: console.log
};

console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
console.log(`║  Database Migration Runner                                    ║`);
console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

console.log(`Connecting to: ${config.host}:${config.port}/${config.database}`);

// Create Sequelize instance
const sequelize = new Sequelize(config);

// Test connection
sequelize.authenticate()
  .then(() => {
    console.log('✓ Database connection successful');
    return runMigrations();
  })
  .then(() => {
    console.log('\n✓ All migrations completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n✗ Migration failed:', error.message);
    process.exit(1);
  });

async function runMigrations() {
  const migrationsPath = path.join(__dirname, 'src', 'migrations');
  
  console.log(`\nLooking for migrations in: ${migrationsPath}`);
  
  // Get all migration files
  const files = fs.readdirSync(migrationsPath)
    .filter(file => file.endsWith('.js'))
    .sort();
  
  console.log(`Found ${files.length} migration files:\n`);
  
  // Execute each migration
  for (const file of files) {
    const migrationPath = path.join(migrationsPath, file);
    console.log(`  → Executing: ${file}`);
    
    try {
      const migration = require(migrationPath);
      
      // Execute up migration
      if (migration.up) {
        await migration.up(sequelize.queryInterface, sequelize.Sequelize);
      }
      
      console.log(`    ✓ Completed`);
    } catch (error) {
      console.error(`    ✗ Failed: ${error.message}`);
      throw error;
    }
  }
  
  console.log(`\n✓ All ${files.length} migrations executed`);
}
