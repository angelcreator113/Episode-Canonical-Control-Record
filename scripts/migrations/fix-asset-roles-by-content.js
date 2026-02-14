/**
 * Fix asset roles by analyzing asset content and names
 * Maps assets to correct roles based on their actual visual content
 */

const { sequelize, Asset } = require('./src/models');

async function fixAssetRolesByContent() {
  try {
    console.log('🔍 Analyzing assets and fixing roles by content...\n');

    const assets = await Asset.findAll({
      attributes: ['id', 'name', 'asset_type', 'asset_role', 's3_url_raw'],
      order: [['created_at', 'DESC']]
    });

    console.log(`Found ${assets.length} total assets\n`);

    let updated = 0;

    for (const asset of assets) {
      const name = asset.name.toLowerCase();
      const currentRole = asset.asset_role;
      let newRole = null;

      // Determine correct role based on filename patterns
      if (name.includes('location') || name.includes('pin') || name.includes('map')) {
        newRole = 'UI.ICON.LOCATION';
      } else if (name.includes('closet') || name.includes('wardrobe') || name.includes('dress')) {
        newRole = 'UI.ICON.CLOSET';
      } else if (name.includes('jewelry') || name.includes('diamond') || name.includes('gem')) {
        newRole = 'UI.ICON.JEWELRY_BOX';
      } else if (name.includes('teddy') || name.includes('bear') || name.includes('toy')) {
        newRole = 'UI.ICON.RESERVED';
      } else if (name.includes('speech') || name.includes('chat') || name.includes('bubble')) {
        newRole = 'UI.ICON.SPEECH';
      } else if (name.includes('perfume') || name.includes('fragrance') || name.includes('flower')) {
        newRole = 'UI.ICON.PERFUME';
      } else if (name.includes('todo') || name.includes('list') || name.includes('checklist')) {
        newRole = 'UI.ICON.TODO_LIST';
      } else if (name.includes('pose') || name.includes('dance')) {
        newRole = 'UI.ICON.POSE';
      } else if (name.includes('logo') || name.includes('title') || name.includes('styling adventures')) {
        newRole = 'BRAND.SHOW.TITLE';
      } else if (name.includes('background') || name.includes('frame') || name.includes('video')) {
        newRole = 'BG.MAIN';
      } else if (name.includes('guest') || asset.asset_type === 'PROMO_GUEST') {
        newRole = 'CHAR.GUEST.1';
      } else if (name.includes('lala') || asset.asset_type === 'PROMO_LALA') {
        newRole = 'CHAR.HOST.LALA';
      }

      // Only update if we determined a new role and it's different from current
      if (newRole && newRole !== currentRole) {
        await asset.update({ asset_role: newRole });
        console.log(`✅ Updated "${asset.name.substring(0, 40)}": ${currentRole || 'NULL'} → ${newRole}`);
        updated++;
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${assets.length - updated}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Show breakdown by role
    const [roleBreakdown] = await sequelize.query(
      `SELECT asset_role, COUNT(*) as count 
       FROM assets 
       WHERE asset_role IS NOT NULL 
       GROUP BY asset_role 
       ORDER BY count DESC`
    );

    console.log('📊 Assets by Role:');
    console.table(roleBreakdown);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run
fixAssetRolesByContent()
  .then(() => {
    console.log('✅ Complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
