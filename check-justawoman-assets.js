/**
 * Check JustAWoman asset status
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'episode_metadata_dev',
  logging: false,
  dialectOptions: {
    ssl: {
      require: false,
      rejectUnauthorized: false,
    },
  },
});

async function checkAssets() {
  try {
    console.log('📊 Checking JustAWoman assets...\n');
    
    const [results] = await sequelize.query(`
      SELECT 
        id,
        asset_type,
        approval_status,
        file_size_bytes,
        created_at
      FROM assets
      WHERE asset_type = 'PROMO_JUSTAWOMANINPERPRIME'
      ORDER BY created_at DESC
    `);

    if (results.length === 0) {
      console.log('❌ No JustAWoman assets found');
    } else {
      console.log(`✅ Found ${results.length} JustAWoman asset(s):\n`);
      results.forEach((asset, i) => {
        console.log(`${i + 1}. ${asset.id}`);
        console.log(`   Type: ${asset.asset_type}`);
        console.log(`   Status: ${asset.approval_status}`);
        console.log(`   Size: ${(asset.file_size_bytes / 1024).toFixed(2)}KB`);
        console.log(`   Created: ${asset.created_at}`);
        console.log();
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAssets();
