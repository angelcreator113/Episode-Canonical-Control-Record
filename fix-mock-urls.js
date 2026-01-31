require('dotenv').config({ path: '.env' });
const models = require('./deploy-package/backend/models');
const sequelize = models.sequelize;

async function fixUrls() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Update all mock URLs to real S3 URLs
    const [updateResult] = await sequelize.query(`
      UPDATE assets 
      SET s3_url_raw = CONCAT('https://episode-metadata-storage-dev.s3.us-east-1.amazonaws.com/', s3_key_raw)
      WHERE s3_url_raw LIKE '%mock-s3.dev%' 
      AND s3_key_raw IS NOT NULL
    `);

    console.log(`✅ Fixed ${updateResult} assets`);

    // Show updated assets
    const [assets] = await sequelize.query(`
      SELECT id, s3_key_raw, s3_url_raw 
      FROM assets 
      WHERE s3_url_raw LIKE '%episode-metadata-storage-dev%'
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    console.log('\n📸 Updated assets:');
    assets.forEach(a => {
      console.log(`  ${a.s3_key_raw.substring(0, 50)}... → ${a.s3_url_raw.substring(0, 80)}...`);
    });

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixUrls();
