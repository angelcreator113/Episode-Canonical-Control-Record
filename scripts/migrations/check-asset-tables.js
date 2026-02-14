const { sequelize } = require('./src/models');

async function checkTables() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Check for asset-related tables
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE '%asset%'
      ORDER BY table_name;
    `);

    console.log('Asset-related tables:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    
    // Check if we need to create asset_labels table
    const hasAssetLabels = tables.some(t => t.table_name === 'asset_labels');
    const hasAssets = tables.some(t => t.table_name === 'assets');
    
    console.log('\n📊 Status:');
    console.log(`  assets table: ${hasAssets ? '✅' : '❌'}`);
    console.log(`  asset_labels table: ${hasAssetLabels ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkTables();
