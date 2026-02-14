/**
 * Check if thumbnails are in database
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

async function checkThumbnails() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected\n');

    const [results] = await sequelize.query(`
      SELECT 
        id, 
        name,
        metadata->>'thumbnail_url' as thumbnail_url,
        s3_url_raw,
        s3_key_raw,
        CASE WHEN metadata->>'thumbnail_url' IS NOT NULL THEN 'HAS THUMBNAIL' ELSE 'NO THUMBNAIL' END as status
      FROM assets 
      ORDER BY created_at DESC
      LIMIT 5;
    `);
    
    console.log('📊 Recent assets and thumbnail status:\n');
    results.forEach(a => {
      console.log('Name:', a.name);
      console.log('  Thumbnail URL:', a.thumbnail_url || '❌ NOT SET');
      console.log('  Status:', a.status);
      console.log('  Raw S3 Key:', a.s3_key_raw?.substring(0, 60) + '...' || 'N/A');
      console.log('');
    });
    
    const [counts] = await sequelize.query(`
      SELECT 
        COUNT(*) FILTER (WHERE metadata->>'thumbnail_url' IS NOT NULL) as with_thumbs,
        COUNT(*) FILTER (WHERE metadata->>'thumbnail_url' IS NULL) as without_thumbs,
        COUNT(*) as total
      FROM assets;
    `);
    
    console.log('\n📈 Summary:');
    console.log('  ✅ With thumbnails:', counts[0].with_thumbs);
    console.log('  ❌ Without thumbnails:', counts[0].without_thumbs);
    console.log('  📦 Total assets:', counts[0].total);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkThumbnails();
