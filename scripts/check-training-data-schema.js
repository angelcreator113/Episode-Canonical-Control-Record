const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { sequelize } = require(path.join(__dirname, '..', 'src', 'models'));

async function checkAndFixSchema() {
  try {
    console.log('🔍 Checking ai_training_data table schema...\n');

    // Check if data_type column exists
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ai_training_data' 
      ORDER BY ordinal_position;
    `);

    console.log('Current columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    const hasDataType = columns.some(col => col.column_name === 'data_type');
    const hasSourceType = columns.some(col => col.column_name === 'source_type');

    console.log('\n📊 Schema Status:');
    console.log(`  - Has 'data_type' column: ${hasDataType}`);
    console.log(`  - Has 'source_type' column: ${hasSourceType}`);

    if (!hasDataType && hasSourceType) {
      console.log('\n⚠️  Old schema detected! The service is using data_type but table has source_type.');
      console.log('📝 Use source_type instead of data_type for now, or run migration to update schema.\n');
    } else if (hasDataType) {
      console.log('\n✅ Schema is up to date!\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAndFixSchema();
