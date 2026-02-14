const { sequelize } = require('./src/models');

(async () => {
  try {
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'assets' AND column_name = 'asset_role'
    `);
    
    if (results.length > 0) {
      console.log('✅ asset_role column exists');
      
      // Check if any assets have roles set
      const [counts] = await sequelize.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(asset_role) as with_role,
          COUNT(*) - COUNT(asset_role) as without_role
        FROM assets
      `);
      
      console.log('📊 Asset role statistics:');
      console.log(`  Total assets: ${counts[0].total}`);
      console.log(`  With role: ${counts[0].with_role}`);
      console.log(`  Without role: ${counts[0].without_role}`);
    } else {
      console.log('❌ asset_role column missing - need to create migration');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
