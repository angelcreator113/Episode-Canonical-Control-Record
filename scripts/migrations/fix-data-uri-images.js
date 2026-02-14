require('dotenv').config();
const {Sequelize} = require('sequelize');
const s = new Sequelize(process.env.DATABASE_URL, {dialect: 'postgres', logging: false});

async function fixWithDataUris() {
  try {
    await s.authenticate();
    
    // Use simple data URIs - 1x1 pixel colored PNGs
    const bluePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const pinkPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    
    await s.query(`
      UPDATE assets 
      SET s3_url_processed = '${bluePng}'
      WHERE asset_role = 'TEXT.TITLE.PRIMARY'
    `);
    
    await s.query(`
      UPDATE assets 
      SET s3_url_processed = '${pinkPng}'
      WHERE asset_role = 'BRAND.SHOW.TITLE'
    `);
    
    console.log('✅ Updated placeholder images to use data URIs (no network required)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await s.close();
  }
}

fixWithDataUris();
