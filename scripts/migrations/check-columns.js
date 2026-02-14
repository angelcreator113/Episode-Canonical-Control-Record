const { sequelize } = require('./src/models');

async function checkColumns() {
  try {
    await sequelize.authenticate();
    
    const [columns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'assets' 
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Assets table columns (' + columns.length + ' total):');
    columns.forEach(col => {
      console.log('  ✓ ' + col.column_name);
    });

    // Check for specific missing columns
    const columnNames = columns.map(c => c.column_name);
    const requiredColumns = [
      'approval_status',
      'processing_job_id', 
      'processing_error',
      'processed_file_size_bytes',
      's3_key_raw',
      's3_url_raw'
    ];

    console.log('\n🔍 Required columns check:');
    requiredColumns.forEach(col => {
      const exists = columnNames.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkColumns();
