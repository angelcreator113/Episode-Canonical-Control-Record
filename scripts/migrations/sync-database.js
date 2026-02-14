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
    console.log('⚠️  WARNING: This will drop all existing tables!');
    
    // Sync all models (force will drop tables and recreate them)
    await sequelize.sync({ force: true, logging: console.log });
    
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
