const { sequelize } = require('./src/models');

(async () => {
  try {
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'assets'
        AND (column_name LIKE '%role%' OR column_name LIKE '%type%')
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Asset columns with "role" or "type":');
    console.table(columns);
    
    // Check some recent assets
    const [assets] = await sequelize.query(`
      SELECT 
        id,
        name,
        asset_type,
        asset_role,
        asset_group,
        created_at
      FROM assets
      ORDER BY created_at DESC
      LIMIT 10;
    `);
    
    console.log('\n📦 Recent 10 assets:');
    console.table(assets);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
