const fs = require('fs');
const path = require('path');

// Load database connection
require('dotenv').config();
const db = require('./src/models');

async function runMigration() {
  try {
    console.log('🔄 Running asset roles migration...');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, 'add-asset-roles-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute SQL
    await db.sequelize.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('✅ Created asset_roles table');
    console.log('✅ Added role_key column to assets');
    console.log('✅ Inserted default roles for all workspaces');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
