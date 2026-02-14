#!/usr/bin/env node

/**
 * Check asset S3 keys in database
 * Shows what S3 keys are stored in the database for assets
 */

const { Sequelize } = require('sequelize');
const path = require('path');

// Database connection
const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgresql://postgres:EpisodeControl2024!Dev@episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com:5432/episode_metadata', {
  logging: false,
  dialect: 'postgres',
});

// Define Asset model inline
const Asset = sequelize.define('Asset', {
  id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
  filename: Sequelize.STRING,
  file_type: Sequelize.STRING,
  status: Sequelize.ENUM('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED'),
  s3_key_raw: Sequelize.STRING,
  s3_key_processed: Sequelize.STRING,
}, { tableName: 'Assets', timestamps: true });

(async () => {
  try {
    console.log('\n📊 Asset S3 Keys in Database\n');
    
    const assets = await Asset.findAll({
      attributes: ['id', 'filename', 'status', 's3_key_raw', 's3_key_processed'],
      limit: 20,
    });

    if (assets.length === 0) {
      console.log('❌ No assets found in database');
      process.exit(0);
    }

    console.log(`Found ${assets.length} assets:\n`);
    
    assets.forEach((asset, idx) => {
      console.log(`${idx + 1}. ${asset.filename}`);
      console.log(`   ID: ${asset.id}`);
      console.log(`   Status: ${asset.status}`);
      console.log(`   S3 Raw: ${asset.s3_key_raw || '(empty)'}`);
      console.log(`   S3 Processed: ${asset.s3_key_processed || '(empty)'}`);
      console.log('');
    });

    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
})();
