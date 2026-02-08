const { sequelize } = require('../src/models');

async function checkAssetsTable() {
  try {
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'assets' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nAssets table columns:');
    results.forEach(r => console.log(' -', r.column_name));
    
    // Check if deleted_at exists
    const hasDeletedAt = results.some(r => r.column_name === 'deleted_at');
    console.log(`\n✓ Has deleted_at column: ${hasDeletedAt}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkAssetsTable();
