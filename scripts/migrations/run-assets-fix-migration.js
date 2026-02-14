const { sequelize } = require('./src/models');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔄 Running assets schema fix migration...\n');

    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'fix-assets-schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await sequelize.query(sql);

    console.log('\n✅ Migration completed successfully!\n');

    // Verify the schema
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'assets' 
      ORDER BY ordinal_position;
    `);

    console.log('📋 Updated Assets table columns:');
    columns.forEach(col => {
      const marker = ['approval_status', 's3_key_raw', 's3_url_raw', 'file_size_bytes'].includes(col.column_name) ? '✨' : '  ';
      console.log(`${marker} - ${col.column_name} (${col.data_type})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runMigration();
