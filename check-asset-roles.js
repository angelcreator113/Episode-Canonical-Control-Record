const { sequelize, Asset } = require('./src/models');

async function checkAssetRoles() {
  try {
    console.log('🔍 Checking asset_role values in database\n');

    const assets = await Asset.findAll({
      attributes: ['id', 'name', 'asset_role', 'asset_group'],
      order: [['created_at', 'DESC']],
      limit: 20
    });

    console.log(`📦 Last 20 assets:\n`);
    
    assets.forEach(asset => {
      console.log(`${asset.name}`);
      console.log(`  Role: ${asset.asset_role || 'NULL'}`);
      console.log(`  Group: ${asset.asset_group || 'NULL'}`);
      console.log('');
    });

    // Check for duplicate roles
    console.log('📊 Assets by role:');
    const byRole = {};
    const allAssets = await Asset.findAll({
      attributes: ['asset_role', 'name']
    });
    
    allAssets.forEach(a => {
      const role = a.asset_role || 'NULL';
      if (!byRole[role]) byRole[role] = [];
      byRole[role].push(a.name);
    });

    Object.entries(byRole).sort().forEach(([role, names]) => {
      console.log(`\n${role}: ${names.length} assets`);
      if (names.length <= 3) {
        names.forEach(n => console.log(`  - ${n}`));
      } else {
        names.slice(0, 3).forEach(n => console.log(`  - ${n}`));
        console.log(`  ... and ${names.length - 3} more`);
      }
    });

    await sequelize.close();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAssetRoles();
