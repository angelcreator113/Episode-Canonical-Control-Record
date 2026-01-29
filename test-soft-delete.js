const { sequelize, Asset } = require('./src/models');

async function testSoftDelete() {
  try {
    console.log('🧪 Testing soft delete functionality\n');

    // Find a test asset
    const testAsset = await Asset.findOne({
      attributes: ['id', 'name', 'asset_type'],
      order: [['created_at', 'DESC']],
    });

    if (!testAsset) {
      console.log('❌ No wardrobe assets found to test with');
      await sequelize.close();
      return;
    }

    console.log(`📦 Found test asset: ${testAsset.name} (${testAsset.id})`);
    console.log('   Type:', testAsset.asset_type);
    console.log();

    // Verify it exists (default query should find it)
    const beforeDelete = await Asset.findByPk(testAsset.id);
    console.log(`✅ BEFORE DELETE: Asset found with default query`);
    console.log(`   deleted_at: ${beforeDelete.deleted_at}`);
    console.log();

    // Soft delete it
    console.log('🗑️ Performing soft delete...');
    const deleteResult = await Asset.destroy({
      where: { id: testAsset.id }
    });
    console.log(`   Result: ${deleteResult} rows affected`);
    console.log();

    // Try to find it with default query (should NOT find it)
    const afterDelete = await Asset.findByPk(testAsset.id);
    console.log(`🔍 AFTER DELETE: Default query result:`);
    if (afterDelete) {
      console.log(`   ❌ PROBLEM: Asset still found!`);
      console.log(`   deleted_at: ${afterDelete.deleted_at}`);
    } else {
      console.log(`   ✅ CORRECT: Asset NOT found (soft-deleted)`);
    }
    console.log();

    // Find it with paranoid: false (should find it with deleted_at timestamp)
    const deletedAsset = await Asset.findByPk(testAsset.id, { paranoid: false });
    console.log(`🔍 Query with paranoid: false:`);
    if (deletedAsset) {
      console.log(`   ✅ CORRECT: Asset found with deleted_at: ${deletedAsset.deleted_at}`);
    } else {
      console.log(`   ❌ PROBLEM: Asset was hard-deleted instead of soft-deleted!`);
    }
    console.log();

    // Restore it for testing
    console.log('♻️ Restoring asset for next test...');
    await Asset.restore({ where: { id: testAsset.id } });
    const restored = await Asset.findByPk(testAsset.id);
    if (restored) {
      console.log(`   ✅ Asset restored successfully`);
    }

    await sequelize.close();
    console.log('\n✅ Test complete');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testSoftDelete();
