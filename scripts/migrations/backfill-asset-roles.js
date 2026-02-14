const { sequelize } = require('./src/models');
const { CANONICAL_ROLES } = require('./src/constants/canonicalRoles');

/**
 * Backfill asset_role from legacy asset_type
 * Maps old types to canonical roles
 */

const TYPE_TO_ROLE_MAPPING = {
  // Characters
  'PROMO_LALA': 'CHAR.HOST.LALA',
  'LALA_VIDEO': 'CHAR.HOST.LALA',
  'LALA_HEADSHOT': 'CHAR.HOST.LALA',
  'LALA_FULLBODY': 'CHAR.HOST.LALA',
  
  'PROMO_JUSTAWOMANINHERPRIME': 'CHAR.HOST.JUSTAWOMANINHERPRIME',
  'BRAND_LOGO': 'BRAND.SHOW.TITLE_GRAPHIC',
  'BRAND_BANNER': 'BRAND.SHOW.TITLE_GRAPHIC',
  
  'PROMO_GUEST': 'CHAR.GUEST.1',
  'GUEST_HEADSHOT': 'CHAR.GUEST.1',
  'GUEST_FULLBODY': 'CHAR.GUEST.1',
  
  // Backgrounds
  'BACKGROUND_IMAGE': 'BG.MAIN',
  'BACKGROUND_VIDEO': 'BG.MAIN',
  'EPISODE_FRAME': 'BG.MAIN',
  
  // Icons (need manual review - can't auto-determine which icon)
  'ICON_GENERIC': null, // Requires manual assignment
  
  // UI Chrome
  'UI_MOUSE': 'UI.MOUSE.CURSOR',
  'UI_EXIT': 'UI.BUTTON.EXIT',
  'UI_MINIMIZE': 'UI.BUTTON.MINIMIZE',
};

(async () => {
  try {
    console.log('🔄 Backfilling asset_role from asset_type...\n');
    
    // Get all assets without roles
    const [assets] = await sequelize.query(`
      SELECT id, asset_type, name, asset_role
      FROM assets
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 Found ${assets.length} total assets\n`);
    
    let updated = 0;
    let skipped = 0;
    let needsManual = 0;
    
    for (const asset of assets) {
      // Skip if already has a role
      if (asset.asset_role) {
        console.log(`⏭️  Skipping ${asset.name} - already has role: ${asset.asset_role}`);
        skipped++;
        continue;
      }
      
      const mappedRole = TYPE_TO_ROLE_MAPPING[asset.asset_type];
      
      if (!mappedRole) {
        console.log(`⚠️  Manual review needed: ${asset.name} (${asset.asset_type}) - no mapping`);
        needsManual++;
        continue;
      }
      
      // Verify role exists in canonical dictionary
      if (!CANONICAL_ROLES[mappedRole]) {
        console.log(`❌ Invalid role ${mappedRole} for asset ${asset.name}`);
        continue;
      }
      
      // Update asset
      await sequelize.query(
        `UPDATE assets SET asset_role = $1 WHERE id = $2`,
        {
          bind: [mappedRole, asset.id],
        }
      );
      
      console.log(`✅ ${asset.name}: ${asset.asset_type} → ${mappedRole}`);
      updated++;
    }
    
    console.log('\n📈 Summary:');
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped (already had role): ${skipped}`);
    console.log(`  Needs manual review: ${needsManual}`);
    
    if (needsManual > 0) {
      console.log('\n⚠️  Some assets need manual role assignment');
      console.log('   Run this query to see them:');
      console.log('   SELECT id, name, asset_type FROM assets WHERE asset_role IS NULL;');
    }
    
    console.log('\n✨ Backfill completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Backfill failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
