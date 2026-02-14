require('dotenv').config();
const { sequelize } = require('./src/models');

async function checkTypes() {
  try {
    const [thumbnailId] = await sequelize.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'thumbnails' 
      AND column_name = 'id'
    `);
    
    console.log('thumbnails.id type:');
    console.table(thumbnailId);
    
    const [sceneThumbnailId] = await sequelize.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'scenes' 
      AND column_name = 'thumbnail_id'
    `);
    
    console.log('\nscenes.thumbnail_id type:');
    console.table(sceneThumbnailId);
    
    console.log('\n✓ Types match:', thumbnailId[0].data_type === sceneThumbnailId[0].data_type ? 'YES' : 'NO');
    console.log(`  thumbnails.id: ${thumbnailId[0].data_type}`);
    console.log(`  scenes.thumbnail_id: ${sceneThumbnailId[0].data_type}`);
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkTypes();
