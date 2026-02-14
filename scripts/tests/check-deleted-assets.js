const { sequelize, Asset } = require('./src/models');

async function checkDeletedAssets() {
  try {
    console.log('🔍 Checking for assets with deleted_at timestamps...\n');

    // Check for deleted assets (paranoid: false shows ALL)
    const allAssets = await Asset.findAll({
      paranoid: false,
      attributes: ['id', 'name', 'asset_type', 'deleted_at'],
      order: [['created_at', 'DESC']],
    });

    const deletedAssets = allAssets.filter(a => a.deleted_at !== null);
    const activeAssets = allAssets.filter(a => a.deleted_at === null);

    console.log(`📊 Total assets in database: ${allAssets.length}`);
    console.log(`✅ Active assets (deleted_at IS NULL): ${activeAssets.length}`);
    console.log(`🗑️ Soft-deleted assets (deleted_at IS NOT NULL): ${deletedAssets.length}\n`);

    if (deletedAssets.length > 0) {
      console.log('🗑️ DELETED ASSETS FOUND:');
      deletedAssets.forEach(asset => {
        console.log(`   - ${asset.name} (${asset.asset_type})`);
        console.log(`     Deleted at: ${asset.deleted_at}`);
      });
      console.log();
    } else {
      console.log('✅ No soft-deleted assets found. All assets are active.\n');
    }

    // Check default query (should exclude deleted)
    const defaultQuery = await Asset.findAll({
      attributes: ['id', 'name'],
      limit: 5,
    });
    
    console.log(`🔍 Default Asset.findAll() returns: ${defaultQuery.length} assets`);
    console.log('   (Should match active count if paranoid mode is working)\n');

    // Verify paranoid setting on model
    console.log(`⚙️ Asset model paranoid setting: ${Asset.options.paranoid}`);
    
    if (Asset.options.paranoid) {
      console.log('✅ Paranoid mode is ENABLED on Asset model');
    } else {
      console.log('❌ WARNING: Paranoid mode is NOT enabled on Asset model!');
    }

    await sequelize.close();
    console.log('\n✅ Check complete');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkDeletedAssets();
