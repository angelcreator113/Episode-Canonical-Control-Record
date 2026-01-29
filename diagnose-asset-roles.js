const { sequelize } = require('./src/models');

(async () => {
  try {
    console.log('🔍 Checking asset_role distribution in database...\n');
    
    // Check all assets and their roles
    const [assets] = await sequelize.query(`
      SELECT 
        id,
        name,
        asset_type,
        asset_role,
        approval_status,
        created_at
      FROM assets
      ORDER BY created_at DESC
      LIMIT 30
    `);
    
    console.log(`📊 Found ${assets.length} recent assets:\n`);
    
    // Group by asset_role
    const roleGroups = {};
    assets.forEach(asset => {
      const role = asset.asset_role || 'NULL';
      if (!roleGroups[role]) {
        roleGroups[role] = [];
      }
      roleGroups[role].push(asset);
    });
    
    // Display by role
    Object.entries(roleGroups).forEach(([role, assetList]) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📁 asset_role: ${role === 'NULL' ? '❌ NULL (NOT SET)' : role}`);
      console.log(`   Count: ${assetList.length}`);
      console.log(`${'='.repeat(60)}`);
      
      assetList.forEach((asset, idx) => {
        console.log(`  ${idx + 1}. ${asset.name}`);
        console.log(`     - ID: ${asset.id}`);
        console.log(`     - Type: ${asset.asset_type}`);
        console.log(`     - Status: ${asset.approval_status}`);
        console.log(`     - Created: ${new Date(asset.created_at).toLocaleString()}`);
      });
    });
    
    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📈 SUMMARY:');
    console.log(`${'='.repeat(60)}`);
    Object.entries(roleGroups).forEach(([role, assetList]) => {
      console.log(`  ${role === 'NULL' ? '❌ NULL' : '✅ ' + role}: ${assetList.length} assets`);
    });
    
    console.log('\n💡 EXPLANATION:');
    console.log('  - Assets with NULL role: Will NOT appear in any Thumbnail Composer slot');
    console.log('  - Assets with "CHAR.HOST.LALA": Appear in "Lala (Host)" slot only');
    console.log('  - Assets with "BG.MAIN": Appear in "Background" slot only');
    console.log('  - Assets with "CHAR.GUEST.1": Appear in "Guest 1" slot only');
    console.log('  - Assets with "UI.ICON.*": Appear in corresponding icon slots');
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('  1. If you see many NULL assets, they need roles assigned');
    console.log('  2. If all assets have the same role, that\'s why they all appear in one slot');
    console.log('  3. Upload a new test asset with role "BG.MAIN" and run this again');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
})();
