/**
 * Diagnostic script to identify wizard issues
 */

const { models } = require('./src/models');
const { sequelize } = require('./src/models');

async function diagnose() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // 1. Check Shows
    console.log('📺 SHOWS:');
    const shows = await models.Show.findAll({
      attributes: ['id', 'name'],
    });
    console.log(`Found ${shows.length} shows:`);
    shows.forEach(show => {
      console.log(`  - ${show.name} (${show.id})`);
    });

    // 2. Check Episodes with show relationship
    console.log('\n📼 EPISODES:');
    const episodes = await models.Episode.findAll({
      attributes: ['id', 'title', 'episode_number', 'show_id'],
      include: [{
        model: models.Show,
        as: 'show',
        attributes: ['name'],
      }],
    });
    console.log(`Found ${episodes.length} episodes:`);
    episodes.forEach(ep => {
      console.log(`  - Episode ${ep.episode_number}: "${ep.title}"`);
      console.log(`    Show: ${ep.show?.name || 'NO SHOW LINKED'}`);
      console.log(`    show_id: ${ep.show_id || 'NULL'}`);
    });

    // 3. Check if show IDs match
    if (shows.length > 0 && episodes.length > 0) {
      const showId = shows[0].id;
      const episodeShowIds = episodes.map(e => e.show_id);
      const matched = episodeShowIds.filter(id => id === showId).length;
      console.log(`\n🔗 ${matched}/${episodes.length} episodes have matching show_id`);
    }

    // 4. Check Templates
    console.log('\n📄 TEMPLATES:');
    const templates = await models.ThumbnailTemplate.findAll({
      attributes: ['id', 'name', 'required_roles', 'show_id'],
    });
    console.log(`Found ${templates.length} templates:`);
    templates.forEach(tmpl => {
      console.log(`  - "${tmpl.name}" (${tmpl.id})`);
      console.log(`    Required roles: ${JSON.stringify(tmpl.required_roles)}`);
      console.log(`    show_id: ${tmpl.show_id || 'NULL'}`);
    });

    // 5. Check Assets by role
    console.log('\n🎨 ASSETS (by distinct roles):');
    const allAssets = await models.Asset.findAll({
      attributes: ['asset_role'],
    });
    const roleSet = new Set(allAssets.map(a => a.asset_role));
    console.log(`Distinct roles: ${Array.from(roleSet).join(', ')}`);

    const assets = await models.Asset.findAll({
      attributes: ['id', 'name', 'asset_role', 's3_url_processed', 's3_url_raw'],
      order: [['asset_role', 'ASC'], ['name', 'ASC']],
    });

    const assetsByRole = {};
    assets.forEach(asset => {
      if (!assetsByRole[asset.asset_role]) {
        assetsByRole[asset.asset_role] = [];
      }
      assetsByRole[asset.asset_role].push(asset);
    });

    Object.entries(assetsByRole).forEach(([role, roleAssets]) => {
      console.log(`\n  ${role}: ${roleAssets.length} assets`);
      roleAssets.slice(0, 3).forEach(asset => {
        console.log(`    - ${asset.name}`);
        console.log(`      processed: ${asset.s3_url_processed ? '✓' : '✗'}`);
        console.log(`      raw: ${asset.s3_url_raw ? '✓' : '✗'}`);
      });
      if (roleAssets.length > 3) {
        console.log(`    ... and ${roleAssets.length - 3} more`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('RECOMMENDATIONS:');
    console.log('='.repeat(60));

    if (shows.length > 0 && episodes.length > 0) {
      const showId = shows[0].id;
      const unmatchedEpisodes = episodes.filter(e => e.show_id !== showId);
      if (unmatchedEpisodes.length > 0) {
        console.log(`\n⚠️  ${unmatchedEpisodes.length} episodes have wrong show_id`);
        console.log(`   Run: UPDATE episodes SET show_id = '${showId}' WHERE show_id IS NULL OR show_id != '${showId}';`);
      }
    }

    const assetsWithoutUrls = assets.filter(a => !a.s3_url_processed && !a.s3_url_raw);
    if (assetsWithoutUrls.length > 0) {
      console.log(`\n⚠️  ${assetsWithoutUrls.length} assets have no URLs (won't show thumbnails)`);
      console.log('   These assets need s3_url_processed or s3_url_raw populated');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

diagnose();
