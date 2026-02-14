require('dotenv').config();
const { sequelize } = require('./src/models');

async function checkSceneThumbnailId() {
  try {
    const [result] = await sequelize.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'scenes' 
      AND column_name = 'thumbnail_id'
    `);
    
    console.log('scenes.thumbnail_id column type:');
    console.table(result);
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSceneThumbnailId();
