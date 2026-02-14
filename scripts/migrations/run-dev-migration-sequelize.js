require('dotenv').config({ path: '.env.aws-staging' });
const { Sequelize } = require('sequelize');
const fs = require('fs');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
);

async function runMigration() {
  try {
    console.log('🔌 Connecting to dev database...');
    console.log('Host:', process.env.DB_HOST);
    console.log('User:', process.env.DB_USER);
    console.log('Database:', process.env.DB_NAME);
    
    await sequelize.authenticate();
    console.log('✅ Connected to dev database');

    console.log('📝 Reading migration file...');
    const sql = fs.readFileSync('add-composition-name-column.sql', 'utf8');
    
    console.log('🚀 Running migration...');
    const [results] = await sequelize.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('Result:', results);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

runMigration();
