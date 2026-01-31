/**
 * Check asset dimensions and encoding in database
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    client_encoding: 'UTF8',
    ssl: process.env.DB_SSL === 'true' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
});

async function checkAssets() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected\n');

    const [results] = await sequelize.query(`
      SELECT 
        id, 
        name, 
        width, 
        height, 
        file_size_bytes,
        octet_length(name) as name_bytes,
        length(name) as name_chars
      FROM assets 
      WHERE name LIKE '%iconsgrahics%' 
      LIMIT 3;
    `);

    console.log('📊 Assets with "iconsgrahics" in name:\n');
    results.forEach(asset => {
      console.log(`Name: ${asset.name}`);
      console.log(`  Dimensions: ${asset.width}×${asset.height}`);
      console.log(`  File size: ${(asset.file_size_bytes / 1024).toFixed(1)} KB`);
      console.log(`  Name length: ${asset.name_chars} chars, ${asset.name_bytes} bytes`);
      console.log('');
    });

    // Check if dimensions contain special characters
    const [dimCheck] = await sequelize.query(`
      SELECT 
        id,
        name,
        width || 'x' || height as dimensions_simple,
        concat(width, '×', height) as dimensions_unicode
      FROM assets 
      WHERE width IS NOT NULL AND height IS NOT NULL
      LIMIT 1;
    `);

    if (dimCheck[0]) {
      console.log('🔍 Dimension string test:');
      console.log('  Simple (x):', dimCheck[0].dimensions_simple);
      console.log('  Unicode (×):', dimCheck[0].dimensions_unicode);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkAssets();
