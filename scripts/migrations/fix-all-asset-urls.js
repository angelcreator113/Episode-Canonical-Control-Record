require('dotenv').config();
const {Sequelize} = require('sequelize');
const s = new Sequelize(process.env.DATABASE_URL, {dialect: 'postgres', logging: false});

async function fixAllAssets() {
  try {
    await s.authenticate();
    console.log('✅ Database connected\n');
    
    // Check current state
    const [current] = await s.query(`
      SELECT id, name, asset_role, s3_url_processed 
      FROM assets 
      WHERE asset_role IN ('TEXT.TITLE.PRIMARY', 'BRAND.SHOW.TITLE')
      ORDER BY created_at DESC
    `);
    
    console.log('Current assets:\n');
    current.forEach(a => {
      console.log(`${a.name} [${a.asset_role}]`);
      console.log(`  URL: ${a.s3_url_processed}\n`);
    });
    
    // Update TEXT.TITLE.PRIMARY
    await s.query(`
      UPDATE assets 
      SET s3_url_processed = 'https://via.placeholder.com/800x200/6366f1/ffffff?text=Episode+Title+Card'
      WHERE asset_role = 'TEXT.TITLE.PRIMARY'
    `);
    
    // Update BRAND.SHOW.TITLE
    await s.query(`
      UPDATE assets 
      SET s3_url_processed = 'https://via.placeholder.com/400x100/ec4899/ffffff?text=Styling+Adventures'
      WHERE asset_role = 'BRAND.SHOW.TITLE'
    `);
    
    console.log('✅ Updated assets with valid placeholder image URLs\n');
    console.log('🔄 Refresh your browser to see the images!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await s.close();
  }
}

fixAllAssets();
