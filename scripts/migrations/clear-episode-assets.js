require('dotenv').config();
const { sequelize } = require('./src/models');

async function clearAssets() {
  try {
    const episodeId = '2b7065de-f599-4c5b-95a7-61df8f91cffa';
    const keepAssetId = 'f5fb22da-31a0-4015-92cf-b7eb853cfb3e'; // sunny closet
    
    const [results] = await sequelize.query(`
      DELETE FROM episode_assets 
      WHERE episode_id = :episodeId 
      AND asset_id != :keepAssetId
      RETURNING asset_id
    `, {
      replacements: { episodeId, keepAssetId }
    });
    
    console.log(`✓ Deleted ${results.length} asset link(s)`);
    
    const [remaining] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM episode_assets 
      WHERE episode_id = :episodeId
    `, {
      replacements: { episodeId }
    });
    
    console.log(`✓ Remaining assets: ${remaining[0].count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

clearAssets();
