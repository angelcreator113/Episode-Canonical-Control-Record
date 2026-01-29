/**
 * Fix NULL asset_role values using raw SQL
 */

const { sequelize } = require('./src/models');

async function fixAssetRoles() {
  try {
    console.log('🔍 Fixing NULL asset_role values with SQL...\n');

    // Update in batches by asset_type
    const updates = [
      { type: 'PROMO_LALA', role: 'CHAR.HOST.LALA' },
      { type: 'PROMO_GUEST', role: 'CHAR.GUEST.1' },
      { type: 'PROMO_JUSTAWOMANINHERPRIME', role: 'BRAND.SHOW.TITLE' },
      { type: 'BRAND_LOGO', role: 'BRAND.SHOW.TITLE' },
      { type: 'EPISODE_FRAME', role: 'BG.MAIN' },
      { type: 'BACKGROUND_IMAGE', role: 'BG.MAIN' },
      { type: 'PROMO_VIDEO', role: 'CHAR.HOST.LALA' },
      { type: 'EPISODE_VIDEO', role: 'BG.MAIN' },
      { type: 'BACKGROUND_VIDEO', role: 'BG.MAIN' },
      { type: 'LOGO', role: 'BRAND.SHOW.TITLE' }
    ];

    let totalUpdated = 0;

    for (const { type, role } of updates) {
      const [results, metadata] = await sequelize.query(
        `UPDATE assets SET asset_role = :role WHERE asset_type = :type AND asset_role IS NULL`,
        {
          replacements: { type, role },
          type: sequelize.QueryTypes.UPDATE
        }
      );
      
      const rowCount = metadata?.rowCount || results || 0;
      if (rowCount > 0) {
        console.log(`✅ Updated ${rowCount} assets: ${type} → ${role}`);
        totalUpdated += rowCount;
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Total updated: ${totalUpdated}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Verify
    const [remaining] = await sequelize.query(
      `SELECT COUNT(*) as count FROM assets WHERE asset_role IS NULL`,
      { type: sequelize.QueryTypes.SELECT }
    );

    console.log(`🔍 Remaining NULL asset_role: ${remaining.count}\n`);

    // Show sample of updated assets
    const [sample] = await sequelize.query(
      `SELECT name, asset_type, asset_role FROM assets 
       WHERE asset_type = 'PROMO_LALA' 
       ORDER BY created_at DESC 
       LIMIT 5`,
      { type: sequelize.QueryTypes.SELECT }
    );

    console.log('📋 Sample of updated PROMO_LALA assets:');
    console.table(sample);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run
fixAssetRoles()
  .then(() => {
    console.log('✅ Complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
