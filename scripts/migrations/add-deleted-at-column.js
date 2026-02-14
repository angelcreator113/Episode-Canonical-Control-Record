/**
 * Add deleted_at column for soft deletes
 */

const { sequelize } = require('./src/models');

async function addDeletedAtColumn() {
  try {
    console.log('🔍 Adding deleted_at column to assets table...\n');

    await sequelize.query(`
      ALTER TABLE assets 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
    `);

    console.log('✅ Column added successfully\n');

    // Verify
    const [results] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'assets' 
      AND column_name = 'deleted_at'
    `);

    console.log('📋 Column info:');
    console.table(results);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run
addDeletedAtColumn()
  .then(() => {
    console.log('✅ Complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
