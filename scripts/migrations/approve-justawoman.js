/**
 * Approve JustAWoman asset
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

async function approveLatestJustAwomanAsset() {
  try {
    console.log('📊 Approving latest JustAWoman asset...\n');
    
    // Get the latest PENDING JustAWoman asset
    const [results] = await sequelize.query(`
      SELECT id FROM assets
      WHERE asset_type = 'PROMO_JUSTAWOMANINPERPRIME'
      AND approval_status = 'PENDING'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (results.length === 0) {
      console.log('❌ No pending JustAWoman assets found');
      process.exit(0);
    }

    const assetId = results[0].id;

    // Approve it
    await sequelize.query(`
      UPDATE assets
      SET approval_status = 'APPROVED'
      WHERE id = $1
    `, {
      bind: [assetId]
    });

    console.log(`✅ Asset ${assetId} approved!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

approveLatestJustAwomanAsset();
