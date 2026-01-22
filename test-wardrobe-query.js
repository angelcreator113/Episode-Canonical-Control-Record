// Quick test to verify tables exist and test the query
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  'episode_metadata',
  'postgres',
  'Ayanna123!!',
  {
    host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  }
);

async function testQuery() {
  try {
    await sequelize.authenticate();
    
    const episodeId = 'fbfdaa3e-c20c-4bda-8fd3-0927c79867c9';
    
    console.log('Testing wardrobe query...');
    const wardrobeLinks = await sequelize.query(
      `SELECT ew.wardrobe_id, ew.scene, ew.worn_at, ew.notes,
              w.id, w.name, w.character, w.clothing_category, 
              w.s3_url, w.s3_url_processed, w.thumbnail_url, 
              w.color, w.season, w.is_favorite, w.created_at
       FROM episode_wardrobe ew
       JOIN wardrobe w ON w.id = ew.wardrobe_id
       WHERE ew.episode_id = :episode_id 
       AND w.deleted_at IS NULL
       ORDER BY ew.created_at DESC`,
      {
        replacements: { episode_id: episodeId },
        type: sequelize.Sequelize.QueryTypes.SELECT
      }
    );
    
    console.log(`✅ Query succeeded, found ${wardrobeLinks.length} items`);
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Query failed:', error.message);
    console.error('Error:', error);
  }
}

testQuery();
