/**
 * Populate asset_role and asset_scope from existing asset_type
 * Maps legacy asset types to the new role-based system
 */

require('dotenv').config();
const {Sequelize} = require('sequelize');
const s = new Sequelize(process.env.DATABASE_URL, {dialect: 'postgres', logging: false});

// Mapping from asset_type to asset_role
const TYPE_TO_ROLE_MAP = {
  'BACKGROUND_VIDEO': 'BG.MAIN',
  'BACKGROUND_IMAGE': 'BG.MAIN',
  'EPISODE_FRAME': 'BG.EPISODE.FRAME',
  'CLOTHING_LALA': 'WARDROBE.HOST.PRIMARY',
  'CLOTHING_JUSTAWOMAN': 'WARDROBE.CO_HOST.JUST_A_WOMAN',
  'PROMO_LALA': 'CHAR.HOST.PRIMARY',
  'PROMO_JUSTAWOMAN': 'CHAR.CO_HOST.JUST_A_WOMAN',
  'PROMO_GUEST': 'CHAR.GUEST',
  'TITLE_CARD': 'TEXT.TITLE.PRIMARY',
  'LOGO': 'BRAND.SHOW.TITLE'
};

async function populateAssetRoles() {
  try {
    await s.authenticate();
    console.log('✅ Database connected\n');

    // Get show ID for "Styling Adventures with lala"
    const [shows] = await s.query("SELECT id, name FROM shows WHERE name = 'Styling Adventures with lala'");
    const showId = shows[0]?.id;
    
    if (!showId) {
      console.log('❌ Could not find show "Styling Adventures with lala"');
      return;
    }
    
    console.log(`📺 Show: Styling Adventures with lala (${showId})\n`);

    // Get all approved assets
    const [assets] = await s.query("SELECT id, name, asset_type, show_id FROM assets WHERE approval_status = 'APPROVED'");
    
    console.log(`Found ${assets.length} approved assets to update\n`);

    let updated = 0;
    let skipped = 0;

    for (const asset of assets) {
      const role = TYPE_TO_ROLE_MAP[asset.asset_type];
      
      if (!role) {
        console.log(`⚠️  Skipping ${asset.name} - no mapping for asset_type: ${asset.asset_type}`);
        skipped++;
        continue;
      }

      // Determine scope:
      // - CLOTHING/WARDROBE assets are SHOW-scoped
      // - CHARACTER/PROMO assets are SHOW-scoped
      // - BACKGROUNDS can be GLOBAL
      // - EPISODE_FRAME is EPISODE-scoped
      let scope = 'GLOBAL';
      if (asset.asset_type.includes('CLOTHING') || 
          asset.asset_type.includes('PROMO') || 
          asset.asset_type.includes('WARDROBE') ||
          asset.asset_type === 'TITLE_CARD' ||
          asset.asset_type === 'LOGO') {
        scope = 'SHOW';
      } else if (asset.asset_type === 'EPISODE_FRAME') {
        scope = 'EPISODE';
      }

      // Update the asset
      await s.query(`
        UPDATE assets 
        SET 
          asset_role = :role,
          asset_scope = :scope,
          show_id = :showId
        WHERE id = :id
      `, {
        replacements: {
          role,
          scope,
          showId,
          id: asset.id
        }
      });

      console.log(`✅ ${asset.name.substring(0, 40).padEnd(42)} ${asset.asset_type.padEnd(25)} → ${role.padEnd(30)} [${scope}]`);
      updated++;
    }

    console.log('\n' + '='.repeat(80));
    console.log(`✅ Updated ${updated} assets`);
    console.log(`⚠️  Skipped ${skipped} assets`);
    console.log('='.repeat(80));

    // Verify the update
    const [roledAssets] = await s.query("SELECT COUNT(*) as count FROM assets WHERE asset_role IS NOT NULL");
    console.log(`\n📊 Total assets with asset_role: ${roledAssets[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await s.close();
  }
}

populateAssetRoles();
