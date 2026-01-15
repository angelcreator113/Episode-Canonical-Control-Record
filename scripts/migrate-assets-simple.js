require('dotenv').config();
const { sequelize } = require('../src/models');

async function migrateAssets() {
  try {
    console.log('🔧 Migrating assets table...\n');
    
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');
    
    const transaction = await sequelize.transaction();
    
    try {
      // Check current schema
      console.log('📋 Checking current schema...');
      const [columns] = await sequelize.query(`
        SELECT column_name, data_type
        FROM information_schema.columns 
        WHERE table_name = 'assets'
        ORDER BY ordinal_position;
      `, { transaction });
      
      const existingColumns = columns.map(c => c.column_name);
      console.log('Current columns:', existingColumns.join(', '), '\n');
      
      // Add missing columns
      console.log('📝 Adding missing columns...\n');
      
      const columnsToAdd = {
        approval_status: {
          sql: `ALTER TABLE assets ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'APPROVED';`,
          description: 'Approval workflow status'
        },
        s3_key_raw: {
          sql: `ALTER TABLE assets ADD COLUMN IF NOT EXISTS s3_key_raw VARCHAR(500);`,
          description: 'S3 key for raw uploaded image'
        },
        s3_url_raw: {
          sql: `ALTER TABLE assets ADD COLUMN IF NOT EXISTS s3_url_raw VARCHAR(500);`,
          description: 'S3 URL for raw uploaded image'
        },
        file_size_bytes: {
          sql: `ALTER TABLE assets ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER;`,
          description: 'File size in bytes'
        },
        s3_key_processed: {
          sql: `ALTER TABLE assets ADD COLUMN IF NOT EXISTS s3_key_processed VARCHAR(500);`,
          description: 'S3 key for processed image'
        },
        s3_url_processed: {
          sql: `ALTER TABLE assets ADD COLUMN IF NOT EXISTS s3_url_processed VARCHAR(500);`,
          description: 'S3 URL for processed image'
        },
        processed_file_size_bytes: {
          sql: `ALTER TABLE assets ADD COLUMN IF NOT EXISTS processed_file_size_bytes INTEGER;`,
          description: 'Processed file size'
        },
        width: {
          sql: `ALTER TABLE assets ADD COLUMN IF NOT EXISTS width INTEGER;`,
          description: 'Image width in pixels'
        },
        height: {
          sql: `ALTER TABLE assets ADD COLUMN IF NOT EXISTS height INTEGER;`,
          description: 'Image height in pixels'
        },
        processing_job_id: {
          sql: `ALTER TABLE assets ADD COLUMN IF NOT EXISTS processing_job_id VARCHAR(255);`,
          description: 'External processing job ID'
        },
        processing_error: {
          sql: `ALTER TABLE assets ADD COLUMN IF NOT EXISTS processing_error TEXT;`,
          description: 'Processing error message'
        },
        processed_at: {
          sql: `ALTER TABLE assets ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;`,
          description: 'Processing completion timestamp'
        },
        deleted_at: {
          sql: `ALTER TABLE assets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`,
          description: 'Soft delete timestamp'
        }
      };
      
      let addedCount = 0;
      for (const [column, config] of Object.entries(columnsToAdd)) {
        if (!existingColumns.includes(column)) {
          console.log(`  ➕ Adding: ${column} - ${config.description}`);
          await sequelize.query(config.sql, { transaction });
          addedCount++;
        } else {
          console.log(`  ✓ Exists: ${column}`);
        }
      }
      
      console.log(`\n📊 Added ${addedCount} new columns\n`);
      
      // Migrate existing data
      console.log('📦 Migrating existing data...');
      const [updateResult] = await sequelize.query(`
        UPDATE assets 
        SET 
          s3_key_raw = COALESCE(s3_key_raw, s3_key),
          s3_url_raw = COALESCE(s3_url_raw, url),
          approval_status = COALESCE(approval_status, 'APPROVED')
        WHERE s3_key IS NOT NULL 
          AND s3_key_raw IS NULL;
      `, { transaction });
      
      console.log(`  ✅ Migrated ${updateResult.rowCount || 0} existing records\n`);
      
      // Add indexes
      console.log('🔍 Adding indexes...');
      
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_assets_type 
        ON assets(asset_type);
      `, { transaction });
      console.log('  ✅ idx_assets_type');
      
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_assets_status 
        ON assets(approval_status);
      `, { transaction });
      console.log('  ✅ idx_assets_status');
      
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_assets_type_status 
        ON assets(asset_type, approval_status);
      `, { transaction });
      console.log('  ✅ idx_assets_type_status');
      
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_assets_created 
        ON assets(created_at);
      `, { transaction });
      console.log('  ✅ idx_assets_created\n');
      
      await transaction.commit();
      console.log('✅ Migration complete!\n');
      
      // Show final schema
      console.log('📋 Final schema:');
      const [finalColumns] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'assets'
        ORDER BY ordinal_position;
      `);
      
      console.log('┌─────────────────────────────┬──────────────────┬──────────┐');
      console.log('│ Column                      │ Type             │ Nullable │');
      console.log('├─────────────────────────────┼──────────────────┼──────────┤');
      finalColumns.forEach(col => {
        const name = col.column_name.padEnd(27);
        const type = col.data_type.padEnd(16);
        const nullable = col.is_nullable.padEnd(8);
        console.log(`│ ${name} │ ${type} │ ${nullable} │`);
      });
      console.log('└─────────────────────────────┴──────────────────┴──────────┘\n');
      
      // Count assets by status
      console.log('📊 Asset statistics:');
      const [stats] = await sequelize.query(`
        SELECT 
          approval_status,
          COUNT(*) as count
        FROM assets
        GROUP BY approval_status
        ORDER BY count DESC;
      `);
      
      if (stats.length > 0) {
        stats.forEach(stat => {
          console.log(`  ${stat.approval_status || 'NULL'}: ${stat.count}`);
        });
      } else {
        console.log('  No assets found');
      }
      
      await sequelize.close();
      console.log('\n🎉 Migration completed successfully!');
      process.exit(0);
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

migrateAssets();