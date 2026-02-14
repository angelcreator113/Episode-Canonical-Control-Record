// This script connects to the database using the same configuration as the running app
const path = require('path');
const fs = require('fs');

// Load the app's models which already have the database connection
const modelsPath = path.join(__dirname, 'deploy-package', 'backend', 'models');
const { sequelize } = require(modelsPath);

async function runMigration() {
  try {
    console.log('🔌 Connecting to database using app configuration...');
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    console.log('📝 Reading migration file...');
    const sql = fs.readFileSync(path.join(__dirname, 'fix-assets-episode-id-type.sql'), 'utf8');
    
    console.log('🚀 Running migration...');
    await sequelize.query(sql);
    
    console.log('✅ Migration completed successfully!');
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runMigration();
