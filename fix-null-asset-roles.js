/**
 * Fix NULL asset_role values
 * Maps legacy asset_type to canonical asset_role
 */

const { Asset } = require('./src/models');

const assetTypeToRoleMap = {
  'PROMO_LALA': 'CHAR.HOST.LALA',
  'PROMO_GUEST': 'CHAR.GUEST.1',
  'PROMO_JUSTAWOMANINHERPRIME': 'BRAND.SHOW.TITLE',
  'BRAND_LOGO': 'BRAND.SHOW.TITLE',
  'EPISODE_FRAME': 'BG.MAIN',
  'BACKGROUND_IMAGE': 'BG.MAIN',
  'PROMO_VIDEO': 'CHAR.HOST.LALA',
  'EPISODE_VIDEO': 'BG.MAIN',
  'BACKGROUND_VIDEO': 'BG.MAIN',
  'LOGO': 'BRAND.SHOW.TITLE'
};

async function fixNullAssetRoles() {
  try {
    console.log('🔍 Finding assets with NULL asset_role...\n');

    const nullRoleAssets = await Asset.findAll({
      where: { asset_role: null },
      attributes: ['id', 'name', 'asset_type', 'asset_role']
    });

    console.log(`Found ${nullRoleAssets.length} assets with NULL asset_role\n`);

    if (nullRoleAssets.length === 0) {
      console.log('✅ All assets already have asset_role set');
      return;
    }

    let updated = 0;
    let skipped = 0;

    for (const asset of nullRoleAssets) {
      const mappedRole = assetTypeToRoleMap[asset.asset_type];
      
      if (mappedRole) {
        await asset.update({ asset_role: mappedRole });
        console.log(`✅ Updated asset "${asset.name}": ${asset.asset_type} → ${mappedRole}`);
        updated++;
      } else {
        console.log(`⚠️  Skipped asset "${asset.name}": No mapping for asset_type "${asset.asset_type}"`);
        skipped++;
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Updated: ${updated}`);
    console.log(`⚠️  Skipped: ${skipped}`);
    console.log(`📊 Total:   ${nullRoleAssets.length}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Verify results
    const remaining = await Asset.count({ where: { asset_role: null } });
    console.log(`🔍 Remaining NULL asset_role: ${remaining}\n`);

  } catch (error) {
    console.error('❌ Error fixing asset roles:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  fixNullAssetRoles()
    .then(() => {
      console.log('✅ Script completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixNullAssetRoles };
