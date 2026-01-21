const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('episode_metadata', 'postgres', 'Ayanna123', {
  host: '127.0.0.1',
  port: 5432,
  dialect: 'postgres',
  logging: false,
});

async function checkAssets() {
  try {
    const [results] = await sequelize.query(`
      SELECT id, name, s3_url_raw, s3_url_processed, asset_group, purpose, allowed_uses, is_global, created_at
      FROM assets 
      ORDER BY created_at DESC 
      LIMIT 5;
    `);

    console.log('\n📦 Last 5 Assets in Database:\n');
    results.forEach((asset, i) => {
      console.log(`${i + 1}. ${asset.name}`);
      console.log(`   ID: ${asset.id}`);
      console.log(`   S3 Raw: ${asset.s3_url_raw}`);
      console.log(`   S3 Processed: ${asset.s3_url_processed}`);
      console.log(`   Group: ${asset.asset_group}`);
      console.log(`   Purpose: ${asset.purpose}`);
      console.log(`   Allowed Uses: ${asset.allowed_uses}`);
      console.log(`   Is Global: ${asset.is_global}`);
      console.log(`   Created: ${asset.created_at}`);
      console.log('');
    });

    await sequelize.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkAssets();
