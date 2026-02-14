require('dotenv').config();
const { sequelize, models } = require('./src/models');

(async () => {
  try {
    const assets = await models.Asset.findAll({ limit: 5 });
    console.log('\n📦 Assets in database:', assets.length);
    if(assets.length > 0) {
      assets.forEach(a => {
        const shortId = a.id.substring(0, 8);
        console.log(`  • ${shortId}... - Type: ${a.asset_type}, Status: ${a.approval_status}`);
      });
    } else {
      console.log('  (no assets found)');
    }

    const compositions = await models.ThumbnailComposition.findAll({ limit: 5 });
    console.log('\n📋 Compositions in database:', compositions.length);
    if(compositions.length > 0) {
      compositions.forEach(c => {
        const shortId = c.id.substring(0, 8);
        console.log(`  • ${shortId}... - Episode: ${c.episode_id}, Status: ${c.status}`);
      });
    } else {
      console.log('  (no compositions found)');
    }

    const episodes = await models.Episode.findAll({ limit: 3 });
    console.log('\n🎬 Sample episodes:', episodes.length);
    if(episodes.length > 0) {
      episodes.forEach(e => {
        console.log(`  • ${e.id} - ${e.title || 'No title'}`);
      });
    }

  } catch(err) {
    console.error('❌ Error:', err.message);
  } finally {
    await sequelize.close();
  }
})();
