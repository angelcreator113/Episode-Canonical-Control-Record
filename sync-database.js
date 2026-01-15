#!/usr/bin/env node
/**
 * Database Sync Script
 * Creates or updates all tables based on model definitions
 */

require('dotenv').config();
const { sequelize } = require('./src/models');

async function syncDatabase() {
  try {
    console.log('🔄 Syncing database schema...');
    
    // Sync all models (creates tables if they don't exist, doesn't alter existing)
    await sequelize.sync({ logging: false });
    
    console.log('✅ Database schema synced successfully!');
    console.log('📊 Tables created/updated:');
    console.log('  - episodes');
    console.log('  - metadata_storages');
    console.log('  - thumbnails');
    console.log('  - processing_queues');
    console.log('  - activity_logs');
    console.log('  - file_storages');
    console.log('  - assets');
    console.log('  - thumbnail_compositions');
    console.log('  - thumbnail_templates');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database sync failed:', error.message);
    process.exit(1);
  }
}

syncDatabase();
