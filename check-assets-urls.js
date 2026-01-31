// Check what assets exist and their URLs
const { sequelize } = require('./deploy-package/backend/models');

async function checkAssets() {
  try {
    await sequelize.authenticate();
    
    const [assets] = await sequelize.query(`
      SELECT id, name, s3_url_raw, s3_url_processed, metadata, created_at
      FROM assets
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('\n📦 Recent Assets:');
    console.table(assets.map(a => ({
      name: a.name,
      s3_url: a.s3_url_raw?.substring(0, 60) + '...',
      created: a.created_at
    })));

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAssets();
