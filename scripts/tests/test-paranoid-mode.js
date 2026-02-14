/**
 * Test Paranoid Mode for Assets
 * 
 * Verifies that soft-deleted assets are properly excluded from queries
 */

const { models } = require('./src/models');

async function testParanoidMode() {
  try {
    console.log('🧪 Testing Asset Model Paranoid Mode\n');

    // Count all assets (should exclude deleted)
    const totalAssets = await models.Asset.count();
    console.log(`✅ Total assets (excluding deleted): ${totalAssets}`);

    // Count including deleted
    const totalIncludingDeleted = await models.Asset.count({ paranoid: false });
    console.log(`📊 Total assets (including deleted): ${totalIncludingDeleted}`);
    console.log(`🗑️ Deleted assets: ${totalIncludingDeleted - totalAssets}\n`);

    // Find all without paranoid (should exclude deleted by default)
    const approvedAssets = await models.Asset.findAll({
      where: { approval_status: 'APPROVED' },
      attributes: ['id', 'name', 'deleted_at'],
      limit: 5
    });
    
    console.log('📦 Sample approved assets (default query):');
    approvedAssets.forEach(asset => {
      console.log(`   ${asset.name} - deleted_at: ${asset.deleted_at || 'NULL'}`);
    });
    console.log('');

    // Find all including deleted
    const approvedIncludingDeleted = await models.Asset.findAll({
      where: { approval_status: 'APPROVED' },
      attributes: ['id', 'name', 'deleted_at'],
      paranoid: false,
      limit: 10
    });
    
    console.log('📦 Assets including deleted (paranoid: false):');
    approvedIncludingDeleted.forEach(asset => {
      const status = asset.deleted_at ? '🗑️ DELETED' : '✅ ACTIVE';
      console.log(`   ${status} ${asset.name}`);
    });
    console.log('');

    // Test the specific query used by AssetRolePicker
    console.log('🎨 Testing Thumbnail Composer query:');
    const thumbnailAssets = await models.Asset.findAll({
      where: {
        approval_status: 'APPROVED',
      },
      limit: 1000,
      attributes: ['id', 'name', 'asset_group', 'asset_scope', 'deleted_at']
    });

    const byGroup = thumbnailAssets.reduce((acc, asset) => {
      const group = asset.asset_group || 'UNKNOWN';
      if (!acc[group]) acc[group] = { active: 0, deleted: 0 };
      if (asset.deleted_at) {
        acc[group].deleted++;
      } else {
        acc[group].active++;
      }
      return acc;
    }, {});

    console.log('📁 Assets by folder:');
    Object.entries(byGroup).forEach(([group, counts]) => {
      console.log(`   ${group}: ${counts.active} active, ${counts.deleted} deleted`);
    });
    console.log('');

    if (Object.values(byGroup).some(g => g.deleted > 0)) {
      console.log('⚠️ WARNING: Deleted assets are appearing in queries!');
      console.log('   This means paranoid mode is NOT working correctly.');
      console.log('   Check that the Asset model has paranoid: true in options.');
    } else {
      console.log('✅ SUCCESS: Paranoid mode is working correctly!');
      console.log('   Deleted assets are properly excluded from queries.');
    }

  } catch (error) {
    console.error('❌ Error testing paranoid mode:', error);
    throw error;
  } finally {
    await models.sequelize.close();
  }
}

// Run if called directly
if (require.main === module) {
  testParanoidMode()
    .then(() => {
      console.log('\n✅ Test complete');
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = testParanoidMode;
