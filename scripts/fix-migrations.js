require('dotenv').config();
const { sequelize } = require('../src/models');

async function fixMigrations() {
  try {
    console.log('🔧 Fixing migration state...\n');
    
    await sequelize.authenticate();
    console.log('✅ Database connected\n');
    
    // Check if SequelizeMeta table exists
    const [tables] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'SequelizeMeta'
      );
    `);
    
    if (!tables[0].exists) {
      console.log('Creating SequelizeMeta table...');
      await sequelize.query(`
        CREATE TABLE "SequelizeMeta" (
          name VARCHAR(255) NOT NULL PRIMARY KEY
        );
      `);
    }
    
    // Get list of migration files
    const fs = require('fs');
    const path = require('path');
    const migrationsDir = path.join(__dirname, '../src/migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('❌ Migrations directory not found');
      process.exit(1);
    }
    
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.js'))
      .sort();
    
    console.log(`Found ${migrationFiles.length} migration files\n`);
    
    // Get already run migrations
    const [executed] = await sequelize.query('SELECT name FROM "SequelizeMeta" ORDER BY name');
    const executedNames = executed.map(r => r.name);
    
    console.log(`Already executed: ${executedNames.length} migrations\n`);
    
    // Find the new migration (update-assets-table)
    const newMigration = migrationFiles.find(f => f.includes('update-assets-table'));
    
    if (!newMigration) {
      console.log('❌ update-assets-table migration not found!');
      console.log('Please create it first with:');
      console.log('  npx sequelize-cli migration:generate --name update-assets-table');
      process.exit(1);
    }
    
    console.log(`New migration to run: ${newMigration}\n`);
    
    // Mark all old migrations as executed (except the new one)
    for (const file of migrationFiles) {
      if (file === newMigration) continue; // Skip the new one
      
      if (!executedNames.includes(file)) {
        console.log(`Marking as executed: ${file}`);
        await sequelize.query(
          'INSERT INTO "SequelizeMeta" (name) VALUES (?)',
          { replacements: [file] }
        );
      }
    }
    
    console.log('\n✅ Migration state fixed!');
    console.log('\nNow you can run:');
    console.log('  npx sequelize-cli db:migrate');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

fixMigrations();