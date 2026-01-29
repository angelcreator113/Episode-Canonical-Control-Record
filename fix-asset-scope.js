/**
 * Fix Asset Scope for Existing Assets
 * 
 * Sets asset_scope = 'GLOBAL' for all assets that have NULL asset_scope
 * This ensures they appear in the folder-based asset picker
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

async function fixAssetScope() {
  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: console.log,
  });

  try {
    console.log('🔧 Fixing asset_scope for existing assets...\n');

    // Check current state
    const [beforeStats] = await sequelize.query(`
      SELECT 
        asset_scope,
        COUNT(*) as count
      FROM assets
      WHERE deleted_at IS NULL
      GROUP BY asset_scope
      ORDER BY asset_scope NULLS FIRST;
    `);

    console.log('📊 Current asset_scope distribution:');
    beforeStats.forEach(row => {
      console.log(`   ${row.asset_scope || 'NULL'}: ${row.count} assets`);
    });
    console.log('');

    // Fix NULL asset_scope values
    const [result] = await sequelize.query(`
      UPDATE assets 
      SET asset_scope = 'GLOBAL'
      WHERE asset_scope IS NULL 
        AND deleted_at IS NULL;
    `);

    const updatedCount = result.rowCount || 0;
    console.log(`✅ Updated ${updatedCount} assets to asset_scope = 'GLOBAL'\n`);

    // Show after stats
    const [afterStats] = await sequelize.query(`
      SELECT 
        asset_scope,
        COUNT(*) as count
      FROM assets
      WHERE deleted_at IS NULL
      GROUP BY asset_scope
      ORDER BY asset_scope;
    `);

    console.log('📊 Updated asset_scope distribution:');
    afterStats.forEach(row => {
      console.log(`   ${row.asset_scope}: ${row.count} assets`);
    });
    console.log('');

    // Show assets by group
    const [groupStats] = await sequelize.query(`
      SELECT 
        asset_group,
        asset_scope,
        COUNT(*) as count
      FROM assets
      WHERE deleted_at IS NULL
        AND asset_group IS NOT NULL
      GROUP BY asset_group, asset_scope
      ORDER BY asset_group, asset_scope;
    `);

    console.log('📁 Assets by folder and scope:');
    groupStats.forEach(row => {
      console.log(`   ${row.asset_group} / ${row.asset_scope}: ${row.count} assets`);
    });
    console.log('');

    console.log('✅ Done! Assets should now appear in Thumbnail Composer folders.\n');
    console.log('💡 Refresh the Thumbnail Composer page to see the updated assets.');

  } catch (error) {
    console.error('❌ Error fixing asset scope:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run if called directly
if (require.main === module) {
  fixAssetScope()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = fixAssetScope;
