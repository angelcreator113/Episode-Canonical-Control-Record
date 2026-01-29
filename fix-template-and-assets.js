/**
 * Update template to use standard roles and fix asset assignments
 */

const { models, sequelize } = require('./src/models');

async function updateTemplate() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // 1. Update template with simple required_roles
    console.log('🔧 Updating template required_roles...');
    const template = await models.ThumbnailTemplate.findOne({
      where: { name: 'Main Episode Thumbnail' },
    });

    if (!template) {
      console.log('❌ Template not found');
      process.exit(1);
    }

    // Simple role system that matches what the wizard expects
    const newRequiredRoles = ['lala', 'background_frame'];
    const newLayoutConfig = {
      width: 1920,
      height: 1080,
      layers: {
        background_frame: {
          xPct: 0,
          yPct: 0,
          wPct: 100,
          hPct: 100,
          zIndex: 0,
        },
        lala: {
          xPct: 60,
          yPct: 10,
          wPct: 35,
          hPct: 85,
          zIndex: 2,
        },
        guest: {
          xPct: 5,
          yPct: 15,
          wPct: 30,
          hPct: 75,
          zIndex: 1,
        },
        justawomen: {
          xPct: 70,
          yPct: 70,
          wPct: 25,
          hPct: 25,
          zIndex: 3,
        },
      },
    };

    await template.update({
      required_roles: newRequiredRoles,
      layout_config: newLayoutConfig,
    });

    console.log(`✅ Updated template required_roles to: ${JSON.stringify(newRequiredRoles)}`);
    console.log(`✅ Updated layout_config with standard roles\n`);

    // 2. Assign roles to assets based on their names
    console.log('🔧 Assigning asset roles based on names...');
    
    const assets = await models.Asset.findAll();
    let updated = 0;

    for (const asset of assets) {
      const nameLower = (asset.name || '').toLowerCase();
      let newRole = null;

      // Determine role from name
      if (nameLower.includes('lala') || nameLower.includes('host')) {
        newRole = 'lala';
      } else if (nameLower.includes('background') || nameLower.includes('frame') || nameLower.includes('episode')) {
        newRole = 'background_frame';
      } else if (nameLower.includes('guest')) {
        newRole = 'guest';
      } else if (nameLower.includes('woman') || nameLower.includes('justawomen')) {
        newRole = 'justawomen';
      } else if (nameLower.includes('logo') || nameLower.includes('brand')) {
        newRole = 'brand';
      } else if (asset.asset_type === 'video') {
        newRole = 'background_frame'; // Default videos to background
      } else if (asset.asset_type === 'image') {
        newRole = 'background_frame'; // Default images to background
      }

      if (newRole && asset.asset_role !== newRole) {
        await asset.update({ asset_role: newRole });
        console.log(`  ✓ ${asset.name} → ${newRole}`);
        updated++;
      }
    }

    console.log(`\n✅ Updated ${updated} asset(s) with roles\n`);

    // 3. Show final state
    console.log('📊 FINAL STATE:');
    const roleCount = await sequelize.query(`
      SELECT asset_role, COUNT(*) as count 
      FROM assets 
      WHERE asset_role IS NOT NULL 
      GROUP BY asset_role 
      ORDER BY asset_role
    `, { type: sequelize.QueryTypes.SELECT });

    console.log('Assets by role:');
    roleCount.forEach(row => {
      console.log(`  - ${row.asset_role}: ${row.count} assets`);
    });

    console.log('\n✅ All fixes complete!');
    console.log('\n🎯 Next steps:');
    console.log('   1. Restart backend: node src/server.js');
    console.log('   2. Refresh the wizard page');
    console.log('   3. You should now see 2 episodes and be able to select assets');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

updateTemplate();
