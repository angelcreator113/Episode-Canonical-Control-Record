/**
 * Create Assets Table
 * Run this script to create the assets table in PostgreSQL
 */

require('dotenv').config();
const { sequelize } = require('./src/models');

async function createAssetsTable() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Create the assets table using raw SQL
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        asset_type VARCHAR(100) NOT NULL,
        description TEXT,
        s3_key VARCHAR(500),
        s3_url_raw VARCHAR(500),
        s3_url_processed VARCHAR(500),
        file_size INTEGER,
        mime_type VARCHAR(255),
        width_pixels INTEGER,
        height_pixels INTEGER,
        duration_seconds INTEGER,
        approval_status VARCHAR(255) DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
        uploaded_by VARCHAR(255),
        approved_by VARCHAR(255),
        rejection_reason TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        s3_key_raw VARCHAR(500),
        s3_bucket VARCHAR(255)
      );

      -- Create indexes for faster queries
      CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);
      CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(approval_status);
      CREATE INDEX IF NOT EXISTS idx_assets_created ON assets(created_at);
      CREATE INDEX IF NOT EXISTS idx_assets_deleted ON assets(deleted_at);
    `;

    console.log('📝 Creating assets table...');
    await sequelize.query(createTableSQL);
    console.log('✅ Assets table created successfully');

    // Verify the table was created
    const [result] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'assets'
      );
    `);

    if (result[0].exists) {
      console.log('✅ Verified: assets table exists in database');
    } else {
      console.error('❌ Error: assets table was not created');
    }

    // Count columns to verify structure
    const [columns] = await sequelize.query(`
      SELECT COUNT(*) as column_count
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'assets';
    `);

    console.log(`✅ Assets table has ${columns[0].column_count} columns`);

    await sequelize.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating assets table:');
    console.error(error.message);
    process.exit(1);
  }
}

createAssetsTable();
