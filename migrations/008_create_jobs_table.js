/**
 * Migration: Create jobs table for job queue system
 * Tracks job status, retries, and results
 */

async function up(db) {
  // Create jobs table
  await db.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      job_type VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      payload JSONB NOT NULL,
      results JSONB,
      error_message TEXT,
      retry_count INT DEFAULT 0,
      max_retries INT DEFAULT 3,
      created_at TIMESTAMP DEFAULT NOW(),
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      next_retry_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Index for user job listing
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_jobs_user_id_status 
    ON jobs(user_id, status, created_at DESC);
  `);

  // Index for finding pending jobs
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_jobs_status_created 
    ON jobs(status, created_at ASC);
  `);

  // Index for finding retryable jobs
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_jobs_next_retry 
    ON jobs(next_retry_at) 
    WHERE status = 'failed' AND retry_count < max_retries;
  `);

  // Index for job type stats
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_jobs_type 
    ON jobs(job_type);
  `);

  // Create queue messages table for tracking
  await db.query(`
    CREATE TABLE IF NOT EXISTS queue_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
      queue_url VARCHAR(500),
      message_id VARCHAR(255),
      receipt_handle VARCHAR(255),
      attempt INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW(),
      processed_at TIMESTAMP,
      deleted_at TIMESTAMP
    );
  `);

  // Index for cleanup of processed messages
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_queue_messages_processed 
    ON queue_messages(processed_at);
  `);

  // Create job metrics table for analytics
  await db.query(`
    CREATE TABLE IF NOT EXISTS job_metrics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
      metric_type VARCHAR(50),
      metric_value FLOAT,
      recorded_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Index for analytics queries
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_job_metrics_type_time 
    ON job_metrics(metric_type, recorded_at DESC);
  `);
}

async function down(db) {
  // Drop tables in reverse order (respecting foreign keys)
  await db.query(`DROP TABLE IF EXISTS job_metrics CASCADE;`);
  await db.query(`DROP TABLE IF EXISTS queue_messages CASCADE;`);
  await db.query(`DROP TABLE IF EXISTS jobs CASCADE;`);
}

module.exports = { up, down };
