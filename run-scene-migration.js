const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/episode_metadata'
});

async function runMigration() {
  try {
    console.log('Adding thumbnail_id column to scenes table...');
    await pool.query(`
      ALTER TABLE scenes 
      ADD COLUMN IF NOT EXISTS thumbnail_id UUID REFERENCES thumbnails(id) ON UPDATE CASCADE ON DELETE SET NULL
    `);
    console.log('✓ Added thumbnail_id column');

    console.log('Adding assets column to scenes table...');
    await pool.query(`
      ALTER TABLE scenes 
      ADD COLUMN IF NOT EXISTS assets JSONB DEFAULT '{}'::jsonb
    `);
    console.log('✓ Added assets column');

    console.log('Creating index on thumbnail_id...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_scenes_thumbnail_id ON scenes(thumbnail_id)
    `);
    console.log('✓ Created index');

    console.log('\n✅ Migration completed successfully!');
    
    // Verify the changes
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'scenes' 
      AND column_name IN ('thumbnail_id', 'assets')
      ORDER BY column_name
    `);
    
    console.log('\n📋 Added columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
