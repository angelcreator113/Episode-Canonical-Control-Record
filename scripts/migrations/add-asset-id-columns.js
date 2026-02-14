require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log
});

async function addAssetIdColumns() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection authenticated');

    // Add asset ID columns
    await sequelize.query(`
      ALTER TABLE thumbnail_compositions 
      ADD COLUMN IF NOT EXISTS background_frame_asset_id UUID,
      ADD COLUMN IF NOT EXISTS lala_asset_id UUID,
      ADD COLUMN IF NOT EXISTS guest_asset_id UUID,
      ADD COLUMN IF NOT EXISTS justawomen_asset_id UUID;
    `);
    
    console.log('✅ Added asset ID columns');

    // Verify columns
    const [columns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'thumbnail_compositions' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\nCurrent columns:', columns.map(c => c.column_name).join(', '));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

addAssetIdColumns();
