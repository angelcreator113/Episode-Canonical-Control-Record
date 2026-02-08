const { sequelize } = require('../src/models');

async function checkTable() {
  try {
    console.log('🔍 Checking user_decisions table structure...');

    const [results] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user_decisions'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Columns in user_decisions table:');
    results.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkTable();
