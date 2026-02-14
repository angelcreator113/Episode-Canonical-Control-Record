require('dotenv').config();
const {Sequelize} = require('sequelize');
const s = new Sequelize(process.env.DATABASE_URL, {dialect: 'postgres', logging: false});

async function fixPlaceholderUrls() {
  try {
    await s.authenticate();
    console.log('✅ Database connected\n');
    
    // Update assets with placeholder.com URLs to use via.placeholder.com (actual working service)
    const [result] = await s.query(`
      UPDATE assets 
      SET s3_url_processed = CASE 
        WHEN asset_role = 'TEXT.TITLE.PRIMARY' THEN 'https://via.placeholder.com/800x200/6366f1/ffffff?text=Episode+Title+Card'
        WHEN asset_role = 'BRAND.SHOW.TITLE' THEN 'https://via.placeholder.com/400x100/ec4899/ffffff?text=Styling+Adventures'
        ELSE s3_url_processed
      END
      WHERE s3_url_processed LIKE 'https://placeholder.com/%'
      RETURNING id, name, asset_role, s3_url_processed
    `);
    
    console.log(`✅ Updated ${result.length} assets with valid placeholder URLs:\n`);
    result.forEach(asset => {
      console.log(`   • ${asset.name} [${asset.asset_role}]`);
      console.log(`     ${asset.s3_url_processed}\n`);
    });
    
    console.log('💡 These URLs use via.placeholder.com - a real placeholder image service');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await s.close();
  }
}

fixPlaceholderUrls();
