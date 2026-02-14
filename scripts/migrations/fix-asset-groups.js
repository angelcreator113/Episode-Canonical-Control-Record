const { sequelize, Asset } = require('./src/models');

/**
 * Map asset_role to asset_group folder
 */
const getAssetGroupFromRole = (assetRole) => {
  if (!assetRole) return null;
  
  if (assetRole.startsWith('CHAR.HOST.LALA')) return 'LALA';
  if (assetRole.startsWith('CHAR.HOST.JUSTAWOMANINHERPRIME')) return 'SHOW';
  if (assetRole.startsWith('CHAR.HOST')) return 'LALA';
  if (assetRole.startsWith('CHAR.GUEST') || assetRole.startsWith('GUEST')) return 'GUEST';
  if (assetRole.startsWith('BG.')) return 'EPISODE';
  if (assetRole.startsWith('BRAND.SHOW') || assetRole.startsWith('UI.ICON.SHOW')) return 'SHOW';
  if (assetRole.startsWith('BRAND.') || assetRole.startsWith('UI.ICON')) return 'SHOW';
  if (assetRole.startsWith('TEXT.')) return 'EPISODE';
  if (assetRole.startsWith('WARDROBE.')) return 'WARDROBE';
  
  return null; // Don't change if no role
};

async function fixAssetGroups() {
  try {
    console.log('🔧 Fixing asset_group assignments based on asset_role\n');

    // Get all assets with asset_role set
    const assets = await Asset.findAll({
      where: {
        asset_role: { [sequelize.Sequelize.Op.ne]: null }
      },
      attributes: ['id', 'name', 'asset_role', 'asset_group']
    });

    console.log(`📦 Found ${assets.length} assets with asset_role set\n`);

    let fixed = 0;
    let unchanged = 0;
    const changes = [];

    for (const asset of assets) {
      const correctGroup = getAssetGroupFromRole(asset.asset_role);
      
      if (!correctGroup) {
        console.log(`⏭️ Skipping ${asset.name} - no group mapping for role: ${asset.asset_role}`);
        unchanged++;
        continue;
      }

      if (asset.asset_group !== correctGroup) {
        console.log(`🔄 Fixing: ${asset.name}`);
        console.log(`   Role: ${asset.asset_role}`);
        console.log(`   Old group: ${asset.asset_group} → New group: ${correctGroup}`);
        
        await Asset.update(
          { asset_group: correctGroup },
          { where: { id: asset.id } }
        );
        
        changes.push({
          name: asset.name,
          role: asset.asset_role,
          oldGroup: asset.asset_group,
          newGroup: correctGroup
        });
        
        fixed++;
      } else {
        unchanged++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Fixed: ${fixed} assets`);
    console.log(`   ⏭️ Unchanged: ${unchanged} assets`);
    
    if (changes.length > 0) {
      console.log('\n📋 Changes made:');
      changes.forEach(change => {
        console.log(`   - ${change.name}: ${change.oldGroup} → ${change.newGroup} (${change.role})`);
      });
    }

    await sequelize.close();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixAssetGroups();
