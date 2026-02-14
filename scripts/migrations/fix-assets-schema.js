/**
 * Fix Assets Table Schema
 * Updates the assets table to match the Asset model definition
 */

require('dotenv').config();
const { sequelize } = require('./src/models');

async function fixAssetsTable() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Get current columns in assets table
    const [currentColumns] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'assets'
      ORDER BY column_name;
    `);

    console.log('\n📋 Current columns in assets table:');
    currentColumns.forEach(col => {
      console.log(`  • ${col.column_name} (${col.data_type})`);
    });

    // Define missing columns to add
    const columnsToAdd = [
      { name: 'file_size_bytes', type: 'INTEGER', exists: false },
      { name: 'processed_file_size_bytes', type: 'INTEGER', exists: false },
      { name: 'width', type: 'INTEGER', exists: false },
      { name: 'height', type: 'INTEGER', exists: false },
      { name: 'processing_job_id', type: 'VARCHAR(255)', exists: false },
      { name: 'processing_error', type: 'TEXT', exists: false },
      { name: 'processed_at', type: 'TIMESTAMP', exists: false },
      { name: 's3_key_processed', type: 'VARCHAR(500)', exists: false },
    ];

    // Check which columns already exist
    columnsToAdd.forEach(col => {
      col.exists = currentColumns.some(c => c.column_name === col.name);
    });

    const missingColumns = columnsToAdd.filter(col => !col.exists);

    if (missingColumns.length === 0) {
      console.log('\n✅ All required columns already exist');
      await sequelize.close();
      process.exit(0);
    }

    console.log(`\n📝 Adding ${missingColumns.length} missing columns...`);

    // Add missing columns
    for (const col of missingColumns) {
      const sql = `ALTER TABLE assets ADD COLUMN ${col.name} ${col.type}`;
      console.log(`  Adding: ${col.name}`);
      await sequelize.query(sql);
    }

    console.log('\n✅ All missing columns added successfully');

    // Verify columns were added
    const [updatedColumns] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'assets'
      ORDER BY column_name;
    `);

    console.log(`\n📋 Updated assets table now has ${updatedColumns.length} columns`);

    await sequelize.close();
    console.log('✅ Schema migration complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing assets table:');
    console.error(error.message);
    process.exit(1);
  }
}

fixAssetsTable();
