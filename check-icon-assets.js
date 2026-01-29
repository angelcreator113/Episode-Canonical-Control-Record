const db = require('./src/models');
const { Asset } = db;

async function checkIconAssets() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Find all assets with UI.ICON roles
    const iconAssets = await Asset.findAll({
      where: {
        deleted_at: null
      },
      attributes: ['id', 'name', 'asset_type', 'asset_role', 'asset_group', 'created_at'],
      order: [['created_at', 'DESC']],
      limit: 20
    });

    console.log(`Found ${iconAssets.length} total assets (showing last 20)\n`);

    iconAssets.forEach(asset => {
      const roleStatus = asset.asset_role ? '✅' : '❌ MISSING';
      console.log(`${roleStatus} Asset: ${asset.name}`);
      console.log(`   ID: ${asset.id}`);
      console.log(`   Type: ${asset.asset_type}`);
      console.log(`   Role: ${asset.asset_role || 'NULL'}`);
      console.log(`   Group: ${asset.asset_group}`);
      console.log(`   Created: ${asset.created_at}`);
      console.log('');
    });

    // Count assets missing role
    const missingRole = iconAssets.filter(a => !a.asset_role);
    console.log(`\n⚠️  ${missingRole.length} assets are missing asset_role field`);

    // Show icon-specific assets
    const icons = iconAssets.filter(a => a.asset_role && a.asset_role.includes('UI.ICON'));
    console.log(`\n🎨 ${icons.length} assets have UI.ICON roles:`);
    icons.forEach(icon => {
      console.log(`   - ${icon.name}: ${icon.asset_role}`);
    });

    await db.sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkIconAssets();
