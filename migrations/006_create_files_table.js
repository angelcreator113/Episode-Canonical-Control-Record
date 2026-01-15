/**
 * Migration: Create files table
 * Tracks uploaded files and their S3 keys
 */

async function up(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS files (
      id UUID PRIMARY KEY,
      episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      file_name VARCHAR(255) NOT NULL,
      file_type VARCHAR(50) NOT NULL,
      file_size BIGINT NOT NULL,
      s3_key VARCHAR(500) NOT NULL UNIQUE,
      s3_url VARCHAR(1000),
      status VARCHAR(50) DEFAULT 'pending', -- pending, uploaded, failed, processing
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      deleted_at TIMESTAMP,
      CONSTRAINT valid_status CHECK (status IN ('pending', 'uploaded', 'failed', 'processing'))
    );
  `);

  // Create indexes
  await db.query(`CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_files_episode_id ON files(episode_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_files_status ON files(status)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_files_s3_key ON files(s3_key)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_files_user_created ON files(user_id, created_at)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_files_deleted ON files(deleted_at)`);
}

async function down(db) {
  await db.query(`DROP TABLE IF EXISTS files CASCADE`);
}

module.exports = { up, down };
