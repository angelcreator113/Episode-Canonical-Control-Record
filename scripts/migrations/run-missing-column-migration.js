const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Ayanna123@127.0.0.1:5432/episode_metadata',
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Checking if current_ai_edit_plan_id column exists...');
    
    // Check if column exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'episodes' 
      AND column_name = 'current_ai_edit_plan_id'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('✅ Column current_ai_edit_plan_id already exists');
      return;
    }
    
    console.log('Adding current_ai_edit_plan_id column to episodes table...');
    
    // Add the column
    await client.query(`
      ALTER TABLE episodes 
      ADD COLUMN IF NOT EXISTS current_ai_edit_plan_id UUID 
      REFERENCES ai_edit_plans(id) ON DELETE SET NULL
    `);
    
    console.log('✅ Added current_ai_edit_plan_id column');
    
    // Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_episodes_current_ai_edit_plan_id 
      ON episodes(current_ai_edit_plan_id)
    `);
    
    console.log('✅ Created index on current_ai_edit_plan_id');
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error(err);
  process.exit(1);
});
