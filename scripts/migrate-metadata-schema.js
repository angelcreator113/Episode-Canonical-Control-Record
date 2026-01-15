/**
 * Migration: Add missing columns to metadata_storage table
 * 
 * Status: Template - Ready for implementation
 * Timeline: Week 2-3 of Phase 2 integration
 * Reversible: Yes (rollback provided)
 * 
 * Affected Records: All existing metadata_storage entries
 * Data Loss Risk: None (adding nullable columns)
 */

require('dotenv').config();
const { sequelize } = require('../src/models');
const { QueryTypes } = require('sequelize');

async function migrate() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🚀 Starting metadata_storage migration...\n');

    // Step 1: Add extracted_text column
    console.log('1️⃣  Adding extracted_text column...');
    await sequelize.query(
      `ALTER TABLE metadata_storage 
       ADD COLUMN IF NOT EXISTS extracted_text TEXT`,
      { transaction }
    );
    console.log('   ✅ extracted_text added\n');

    // Step 2: Add JSON columns for ML/AI results
    console.log('2️⃣  Adding ML/AI analysis columns...');
    await sequelize.query(
      `ALTER TABLE metadata_storage 
       ADD COLUMN IF NOT EXISTS scenes_detected JSONB,
       ADD COLUMN IF NOT EXISTS sentiment_analysis JSONB,
       ADD COLUMN IF NOT EXISTS visual_objects JSONB`,
      { transaction }
    );
    console.log('   ✅ scenes_detected added');
    console.log('   ✅ sentiment_analysis added');
    console.log('   ✅ visual_objects added\n');

    // Step 3: Add transcription column
    console.log('3️⃣  Adding transcription column...');
    await sequelize.query(
      `ALTER TABLE metadata_storage 
       ADD COLUMN IF NOT EXISTS transcription TEXT`,
      { transaction }
    );
    console.log('   ✅ transcription added\n');

    // Step 4: Add tagging/categorization columns
    console.log('4️⃣  Adding tagging columns...');
    await sequelize.query(
      `ALTER TABLE metadata_storage 
       ADD COLUMN IF NOT EXISTS tags JSONB,
       ADD COLUMN IF NOT EXISTS categories JSONB`,
      { transaction }
    );
    console.log('   ✅ tags added');
    console.log('   ✅ categories added\n');

    // Step 5: Add processing metadata
    console.log('5️⃣  Adding processing metadata...');
    await sequelize.query(
      `ALTER TABLE metadata_storage 
       ADD COLUMN IF NOT EXISTS extraction_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       ADD COLUMN IF NOT EXISTS processing_duration_seconds INTEGER`,
      { transaction }
    );
    console.log('   ✅ extraction_timestamp added');
    console.log('   ✅ processing_duration_seconds added\n');

    // Step 6: Create indexes for performance
    console.log('6️⃣  Creating indexes...');
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_metadata_extraction_time 
       ON metadata_storage(extraction_timestamp DESC)`,
      { transaction }
    );
    console.log('   ✅ idx_metadata_extraction_time created');

    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_metadata_episode_id 
       ON metadata_storage(episode_id)`,
      { transaction }
    );
    console.log('   ✅ idx_metadata_episode_id created\n');

    // Step 7: Verify migration
    console.log('7️⃣  Verifying migration...');
    const result = await sequelize.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'metadata_storage'`,
      { type: QueryTypes.SELECT, transaction }
    );

    const expectedColumns = [
      'extracted_text', 'scenes_detected', 'sentiment_analysis',
      'visual_objects', 'transcription', 'tags', 'categories',
      'extraction_timestamp', 'processing_duration_seconds'
    ];

    const actualColumns = result.map(r => r.column_name);
    const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));

    if (missingColumns.length === 0) {
      console.log('   ✅ All columns verified\n');
    } else {
      throw new Error(`Missing columns: ${missingColumns.join(', ')}`);
    }

    // Commit transaction
    await transaction.commit();
    console.log('✅ Migration completed successfully!\n');
    console.log('Summary:');
    console.log('  • 9 new columns added');
    console.log('  • 2 indexes created');
    console.log('  • 0 records lost');
    console.log('  • Rollback available: Run rollback-metadata.js\n');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration failed:', error.message);
    console.error('\nRollback executed - no changes applied');
    process.exit(1);
  }
}

/**
 * Rollback function - Removes migration if needed
 */
async function rollback() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🔄 Rolling back metadata_storage migration...\n');

    // Drop indexes
    await sequelize.query(
      `DROP INDEX IF EXISTS idx_metadata_extraction_time`,
      { transaction }
    );
    await sequelize.query(
      `DROP INDEX IF EXISTS idx_metadata_episode_id`,
      { transaction }
    );

    // Drop columns
    await sequelize.query(
      `ALTER TABLE metadata_storage 
       DROP COLUMN IF EXISTS extracted_text,
       DROP COLUMN IF EXISTS scenes_detected,
       DROP COLUMN IF EXISTS sentiment_analysis,
       DROP COLUMN IF EXISTS visual_objects,
       DROP COLUMN IF EXISTS transcription,
       DROP COLUMN IF EXISTS tags,
       DROP COLUMN IF EXISTS categories,
       DROP COLUMN IF EXISTS extraction_timestamp,
       DROP COLUMN IF EXISTS processing_duration_seconds`,
      { transaction }
    );

    await transaction.commit();
    console.log('✅ Rollback completed successfully\n');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Rollback failed:', error.message);
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  const command = process.argv[2];

  if (command === '--rollback') {
    rollback().then(() => process.exit(0));
  } else if (command === '--dry-run') {
    console.log('🔍 DRY RUN - Would make these changes:\n');
    console.log('1. Add extracted_text (TEXT)');
    console.log('2. Add scenes_detected (JSONB)');
    console.log('3. Add sentiment_analysis (JSONB)');
    console.log('4. Add visual_objects (JSONB)');
    console.log('5. Add transcription (TEXT)');
    console.log('6. Add tags (JSONB)');
    console.log('7. Add categories (JSONB)');
    console.log('8. Add extraction_timestamp (TIMESTAMP)');
    console.log('9. Add processing_duration_seconds (INTEGER)');
    console.log('10. Create 2 performance indexes\n');
    console.log('To execute: node scripts/migrate-metadata-schema.js\n');
    process.exit(0);
  } else {
    migrate().then(() => process.exit(0));
  }
}

module.exports = { migrate, rollback };
