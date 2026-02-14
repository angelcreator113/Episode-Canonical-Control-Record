const { sequelize, Asset } = require('./src/models');

async function checkAssetScoping() {
  try {
    console.log('🔍 Checking asset scoping for Thumbnail Composer\n');

    const lalaAssets = await Asset.findAll({
      where: { asset_group: 'LALA' },
      attributes: ['id', 'name', 'asset_type', 'asset_scope', 'show_id', 'episode_id', 'is_global'],
      order: [['created_at', 'DESC']],
    });

    console.log(`📊 Total LALA assets: ${lalaAssets.length}\n`);

    const global = lalaAssets.filter(a => a.asset_scope === 'GLOBAL');
    const show = lalaAssets.filter(a => a.asset_scope === 'SHOW');
    const episode = lalaAssets.filter(a => a.asset_scope === 'EPISODE');

    console.log('By Scope:');
    console.log(`   GLOBAL: ${global.length} (should show in ALL episodes)`);
    console.log(`   SHOW: ${show.length} (should show only in episodes of same show)`);
    console.log(`   EPISODE: ${episode.length} (should show only in specific episode)`);
    console.log();

    // Check if SHOW-scoped assets have show_id set
    if (show.length > 0) {
      console.log('📋 SHOW-scoped assets:');
      const withShowId = show.filter(a => a.show_id);
      const withoutShowId = show.filter(a => !a.show_id);
      console.log(`   With show_id: ${withShowId.length}`);
      console.log(`   Without show_id (❌ PROBLEM): ${withoutShowId.length}`);
      
      if (withShowId.length > 0) {
        const showIds = [...new Set(withShowId.map(a => a.show_id))];
        console.log(`   Show IDs: ${showIds.join(', ')}`);
      }
      console.log();
    }

    // Check if EPISODE-scoped assets have episode_id set
    if (episode.length > 0) {
      console.log('📋 EPISODE-scoped assets:');
      const withEpisodeId = episode.filter(a => a.episode_id);
      const withoutEpisodeId = episode.filter(a => !a.episode_id);
      console.log(`   With episode_id: ${withEpisodeId.length}`);
      console.log(`   Without episode_id (❌ PROBLEM): ${withoutEpisodeId.length}`);
      console.log();
    }

    console.log('💡 EXPECTED BEHAVIOR:');
    console.log('   Thumbnail Composer should show:');
    console.log('   1. GLOBAL assets (18)');
    console.log('   2. SHOW assets matching current episode\'s show_id');
    console.log('   3. EPISODE assets matching current episode_id');
    console.log();
    console.log('   Currently showing: 26 assets (GLOBAL + all SHOW)');
    console.log('   This means it\'s not filtering SHOW assets by show_id!');

    await sequelize.close();
    console.log('\n✅ Analysis complete');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAssetScoping();
