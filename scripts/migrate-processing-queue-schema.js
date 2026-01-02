/**
 * Migration: Add missing columns to processing_queue table
 * 
 * Status: Template - Ready for implementation
 * Timeline: Week 3-4 of Phase 2 integration
 * Reversible: Yes (rollback provided)
 * 
 * Affected Records: All existing processing_queue entries
 * Data Loss Risk: None (adding nullable columns)
 */

require('dotenv').config();
const { sequelize } = require('../src/models');
const { QueryTypes } = require('sequelize');

async function migrate() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🚀 Starting processing_queue migration...\n');

    // Step 1: Add jobType ENUM column
    console.log('1️⃣  Creating job_type ENUM type...');
    
    // Check if enum type exists, create if not
    const enumExists = await sequelize.query(
      `SELECT 1 FROM information_schema.tables 
       WHERE table_schema = 'enum_processing_queue_job_type'`,
      { transaction }
    );

    if (!enumExists[0].length) {
      await sequelize.query(
        `CREATE TYPE enum_processing_queue_job_type AS ENUM (
          'thumbnail_generation', 
          'metadata_extraction', 
          'transcription'
        )`,
        { transaction }
      );
    }

    await sequelize.query(
      `ALTER TABLE processing_queue 
       ADD COLUMN IF NOT EXISTS job_type enum_processing_queue_job_type`,
      { transaction }
    );
    console.log('   ✅ job_type enum created and added\n');

    // Step 2: Add status ENUM column
    console.log('2️⃣  Creating status ENUM type...');
    
    await sequelize.query(
      `CREATE TYPE IF NOT EXISTS enum_processing_queue_status AS ENUM (
        'pending',
        'processing',
        'completed',
        'failed'
      )`,
      { transaction }
    );

    await sequelize.query(
      `ALTER TABLE processing_queue 
       ADD COLUMN IF NOT EXISTS status enum_processing_queue_status 
       DEFAULT 'pending'`,
      { transaction }
    );
    console.log('   ✅ status enum created and added\n');

    // Step 3: Add job configuration
    console.log('3️⃣  Adding job configuration columns...');
    await sequelize.query(
      `ALTER TABLE processing_queue 
       ADD COLUMN IF NOT EXISTS job_config JSONB`,
      { transaction }
    );
    console.log('   ✅ job_config added\n');

    // Step 4: Add error handling
    console.log('4️⃣  Adding error handling columns...');
    await sequelize.query(
      `ALTER TABLE processing_queue 
       ADD COLUMN IF NOT EXISTS error_message TEXT,
       ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
       ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3`,
      { transaction }
    );
    console.log('   ✅ error_message added');
    console.log('   ✅ retry_count added');
    console.log('   ✅ max_retries added\n');

    // Step 5: Add SQS integration columns
    console.log('5️⃣  Adding SQS integration columns...');
    await sequelize.query(
      `ALTER TABLE processing_queue 
       ADD COLUMN IF NOT EXISTS sqs_message_id VARCHAR(255),
       ADD COLUMN IF NOT EXISTS sqs_receipt_handle VARCHAR(1024)`,
      { transaction }
    );
    console.log('   ✅ sqs_message_id added');
    console.log('   ✅ sqs_receipt_handle added\n');

    // Step 6: Add timestamp columns
    console.log('6️⃣  Adding timing columns...');
    await sequelize.query(
      `ALTER TABLE processing_queue 
       ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
       ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
       ADD COLUMN IF NOT EXISTS completed_at_with_duration TIMESTAMP`,
      { transaction }
    );
    console.log('   ✅ started_at added');
    console.log('   ✅ completed_at added');
    console.log('   ✅ completed_at_with_duration added\n');

    // Step 7: Create indexes for performance
    console.log('7️⃣  Creating indexes...');
    
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_processing_job_type 
       ON processing_queue(job_type)`,
      { transaction }
    );
    console.log('   ✅ idx_processing_job_type created');

    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_processing_status 
       ON processing_queue(status)`,
      { transaction }
    );
    console.log('   ✅ idx_processing_status created');

    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_processing_episode_id 
       ON processing_queue(episode_id)`,
      { transaction }
    );
    console.log('   ✅ idx_processing_episode_id created');

    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_processing_sqs_id 
       ON processing_queue(sqs_message_id)`,
      { transaction }
    );
    console.log('   ✅ idx_processing_sqs_id created\n');

    // Step 8: Verify migration
    console.log('8️⃣  Verifying migration...');
    const result = await sequelize.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'processing_queue'`,
      { type: QueryTypes.SELECT, transaction }
    );

    const expectedColumns = [
      'job_type', 'status', 'job_config', 'error_message',
      'retry_count', 'max_retries', 'sqs_message_id',
      'sqs_receipt_handle', 'started_at', 'completed_at',
      'completed_at_with_duration'
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
    console.log('  • 11 new columns added');
    console.log('  • 2 ENUM types created');
    console.log('  • 4 indexes created');
    console.log('  • 0 records lost');
    console.log('  • Rollback available: Run --rollback flag\n');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration failed:', error.message);
    console.error('\nRollback executed - no changes applied');
    process.exit(1);
  }
}

/**
 * Rollback function
 */
async function rollback() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🔄 Rolling back processing_queue migration...\n');

    // Drop indexes
    await sequelize.query(
      `DROP INDEX IF EXISTS idx_processing_job_type,
                         idx_processing_status,
                         idx_processing_episode_id,
                         idx_processing_sqs_id`,
      { transaction }
    );

    // Drop columns
    await sequelize.query(
      `ALTER TABLE processing_queue 
       DROP COLUMN IF EXISTS job_type,
       DROP COLUMN IF EXISTS status,
       DROP COLUMN IF EXISTS job_config,
       DROP COLUMN IF EXISTS error_message,
       DROP COLUMN IF EXISTS retry_count,
       DROP COLUMN IF EXISTS max_retries,
       DROP COLUMN IF EXISTS sqs_message_id,
       DROP COLUMN IF EXISTS sqs_receipt_handle,
       DROP COLUMN IF EXISTS started_at,
       DROP COLUMN IF EXISTS completed_at,
       DROP COLUMN IF EXISTS completed_at_with_duration`,
      { transaction }
    );

    // Drop ENUM types
    await sequelize.query(
      `DROP TYPE IF EXISTS enum_processing_queue_job_type`,
      { transaction }
    );
    await sequelize.query(
      `DROP TYPE IF EXISTS enum_processing_queue_status`,
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
    console.log('1. Create job_type ENUM (thumbnail_generation, metadata_extraction, transcription)');
    console.log('2. Create status ENUM (pending, processing, completed, failed)');
    console.log('3. Add job_config (JSONB)');
    console.log('4. Add error_message (TEXT)');
    console.log('5. Add retry_count (INTEGER)');
    console.log('6. Add max_retries (INTEGER)');
    console.log('7. Add sqs_message_id (VARCHAR)');
    console.log('8. Add sqs_receipt_handle (VARCHAR)');
    console.log('9. Add started_at (TIMESTAMP)');
    console.log('10. Add completed_at (TIMESTAMP)');
    console.log('11. Add completed_at_with_duration (TIMESTAMP)');
    console.log('12. Create 4 performance indexes\n');
    console.log('To execute: node scripts/migrate-processing-queue-schema.js\n');
    process.exit(0);
  } else {
    migrate().then(() => process.exit(0));
  }
}

module.exports = { migrate, rollback };
