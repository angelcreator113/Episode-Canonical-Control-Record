const db = require('./src/models');

async function checkTables() {
  try {
    const [results] = await db.sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%wardrobe%'
      ORDER BY table_name
    `);
    
    console.log('\n📋 Wardrobe Tables Found:');
    console.log(JSON.stringify(results, null, 2));
    
    // Check wardrobe table columns
    const [wardrobeColumns] = await db.sequelize.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'wardrobe'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Wardrobe Table Columns:');
    console.log(JSON.stringify(wardrobeColumns, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit();
  }
}

checkTables();
