// Check the schema of thumbnail_compositions table
const path = require('path');
const { sequelize } = require('./deploy-package/backend/models');

async function checkSchema() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');

    const [results] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'thumbnail_compositions' 
      ORDER BY ordinal_position
    `);

    console.log('📋 thumbnail_compositions schema:');
    console.table(results);

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSchema();
