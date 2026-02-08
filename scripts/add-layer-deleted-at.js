const { sequelize } = require('../src/models');

async function addDeletedAtColumns() {
  try {
    console.log('🔧 Adding deleted_at columns to layer management tables...\n');

    // Add deleted_at to layer_assets
    console.log('1. Adding deleted_at to layer_assets...');
    await sequelize.query(`
      ALTER TABLE layer_assets 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE
    `);
    console.log('   ✅ layer_assets.deleted_at added\n');

    console.log('2. Verifying columns...');
    const [layerAssetsColumns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'layer_assets' AND column_name = 'deleted_at'
    `);
    
    if (layerAssetsColumns.length > 0) {
      console.log('   ✅ layer_assets.deleted_at verified');
    } else {
      console.log('   ❌ layer_assets.deleted_at not found!');
    }

    console.log('\n🎉 Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

addDeletedAtColumns();
