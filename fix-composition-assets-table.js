require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log
});

async function fixCompositionAssetsTable() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection authenticated');

    // Check current columns
    const [currentColumns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'composition_assets' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\nCurrent columns:', currentColumns.map(c => c.column_name).join(', '));

    // Add missing timestamp columns
    await sequelize.query(`
      ALTER TABLE composition_assets 
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    `);
    
    console.log('✅ Added timestamp columns');

    // Verify final columns
    const [finalColumns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'composition_assets' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\nFinal columns:', finalColumns.map(c => c.column_name).join(', '));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

fixCompositionAssetsTable();
