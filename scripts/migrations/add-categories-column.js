const { sequelize } = require('./src/models');

async function addCategoriesColumn() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    await sequelize.query(`
      ALTER TABLE episodes 
      ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '[]'::jsonb
    `);
    
    console.log('✅ Added categories column to Episodes table');
    
    // Verify the column was added
    const [results] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'episodes' AND column_name = 'categories'
    `);
    
    if (results.length > 0) {
      console.log('✅ Verified: categories column exists');
      console.log(results[0]);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
    process.exit();
  }
}

addCategoriesColumn();
