const { sequelize, Asset } = require('./src/models');

async function checkEpisodeAssets() {
  try {
    console.log('🔍 Checking assets linked to episode\n');

    // Get episode assets via junction table
    const episodeAssets = await sequelize.query(`
      SELECT 
        ea.episode_id,
        a.id,
        a.name,
        a.asset_role,
        a.asset_group,
        ea.created_at as linked_at
      FROM episode_assets ea
      INNER JOIN assets a ON ea.asset_id = a.id
      WHERE a.deleted_at IS NULL
      ORDER BY ea.created_at DESC
      LIMIT 20
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    console.log(`📦 Found ${episodeAssets.length} assets linked to episodes\n`);

    // Group by episode
    const byEpisode = {};
    episodeAssets.forEach(a => {
      if (!byEpisode[a.episode_id]) byEpisode[a.episode_id] = [];
      byEpisode[a.episode_id].push(a);
    });

    Object.entries(byEpisode).forEach(([episodeId, assets]) => {
      console.log(`\n📺 Episode: ${episodeId}`);
      console.log(`   ${assets.length} linked assets:`);
      assets.forEach(a => {
        console.log(`   - ${a.name}`);
        console.log(`     Role: ${a.asset_role || 'NULL'}`);
        console.log(`     Group: ${a.asset_group || 'NULL'}`);
      });
    });

    // Check for icon assets specifically
    console.log('\n\n🎨 Checking all ICON assets in database:');
    const iconAssets = await Asset.findAll({
      where: {
        asset_role: {
          [sequelize.Sequelize.Op.like]: 'UI.ICON%'
        }
      },
      attributes: ['id', 'name', 'asset_role', 'asset_group']
    });

    console.log(`   Found ${iconAssets.length} icon assets total\n`);
    iconAssets.forEach(a => {
      console.log(`   - ${a.name}`);
      console.log(`     Role: ${a.asset_role}`);
      console.log(`     Group: ${a.asset_group}`);
      console.log('');
    });

    // Check if icons are linked to any episode
    const linkedIconIds = episodeAssets
      .filter(a => a.asset_role && a.asset_role.startsWith('UI.ICON'))
      .map(a => a.id);

    const unlinkedIcons = iconAssets.filter(a => !linkedIconIds.includes(a.id));
    
    if (unlinkedIcons.length > 0) {
      console.log(`\n⚠️ ${unlinkedIcons.length} icon assets are NOT linked to any episode:`);
      unlinkedIcons.forEach(a => {
        console.log(`   - ${a.name} (${a.asset_role})`);
      });
      console.log('\n💡 These icons need to be linked to episodes to appear in Thumbnail Composer');
    }

    await sequelize.close();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkEpisodeAssets();
