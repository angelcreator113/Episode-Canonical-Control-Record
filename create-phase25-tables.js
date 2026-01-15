#!/usr/bin/env node
/**
 * Create Asset Table Directly
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'episode_metadata_dev',
  logging: false,
});

async function createAssetTable() {
  try {
    console.log('🔄 Creating Asset table...');
    
    const query = `
      CREATE TABLE IF NOT EXISTS "assets" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "asset_type" VARCHAR(50) NOT NULL,
        "s3_key_raw" VARCHAR(500),
        "s3_key_processed" VARCHAR(500),
        "has_transparency" BOOLEAN DEFAULT false,
        "width" INTEGER,
        "height" INTEGER,
        "file_size_bytes" INTEGER,
        "content_type" VARCHAR(100),
        "uploaded_by" VARCHAR(255),
        "approval_status" VARCHAR(50) DEFAULT 'PENDING',
        "metadata" JSONB,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await sequelize.query(query);
    console.log('✅ Asset table created successfully!');
    
    // Create other Phase 2.5 tables
    console.log('🔄 Creating ThumbnailComposition table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "thumbnail_compositions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "episode_id" UUID,
        "template_id" UUID,
        "lala_asset_id" UUID,
        "guest_asset_id" UUID,
        "frame_asset_id" UUID,
        "status" VARCHAR(50) DEFAULT 'DRAFT',
        "metadata" JSONB,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ ThumbnailComposition table created!');
    
    console.log('🔄 Creating ThumbnailTemplate table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "thumbnail_templates" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "formats" JSONB,
        "is_active" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ ThumbnailTemplate table created!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createAssetTable();
