const { getPool, closePool } = require('./src/config/database');

async function createVideoCompositionsTable() {
  const pool = getPool();
  
  try {
    console.log('Creating video_compositions table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS video_compositions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'complete', 'error')),
        scenes JSONB DEFAULT '[]'::jsonb,
        assets JSONB DEFAULT '[]'::jsonb,
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    console.log('✅ Table created successfully');
    
    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_video_compositions_episode_id ON video_compositions(episode_id);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_video_compositions_status ON video_compositions(status);
    `);
    
    console.log('✅ Indexes created successfully');
    
    await closePool();
    console.log('✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating table:', error);
    await closePool();
    process.exit(1);
  }
}

createVideoCompositionsTable();
