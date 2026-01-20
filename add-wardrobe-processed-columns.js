const { Sequelize } = require('sequelize');
require('dotenv').config();

async function addProcessedColumns() {
  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: console.log
  });

  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Add the columns
    await sequelize.query(`
      ALTER TABLE wardrobe 
      ADD COLUMN IF NOT EXISTS s3_key_processed VARCHAR(500),
      ADD COLUMN IF NOT EXISTS s3_url_processed TEXT;
    `);

    console.log('✅ Added s3_key_processed and s3_url_processed columns');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sequelize.close();
  }
}

addProcessedColumns();
