/**
 * Check outfit sets schema
 */
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: false,
  dialect: 'postgres'
});

async function checkOutfitSchema() {
  try {
    console.log('🔍 Checking outfit sets schema...\n');

    const [outfitSetsColumns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'outfit_sets'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 OUTFIT_SETS TABLE:');
    console.log('=====================');
    outfitSetsColumns.forEach(col => {
      console.log(`  ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    const [outfitSetItemsColumns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'outfit_set_items'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 OUTFIT_SET_ITEMS TABLE:');
    console.log('===========================');
    outfitSetItemsColumns.forEach(col => {
      console.log(`  ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await sequelize.close();
  }
}

checkOutfitSchema();
