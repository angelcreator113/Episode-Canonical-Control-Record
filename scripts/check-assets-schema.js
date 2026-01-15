require('dotenv').config();
const { sequelize } = require('../src/models');

async function checkSchema() {
  try {
    console.log('🔍 Checking assets table schema...\n');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connected\n');
    
    // Get table description
    const [results] = await sequelize.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'assets'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Assets Table Schema:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Column Name                    Type              Nullable  Default');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    results.forEach(col => {
      const name = col.column_name.padEnd(30);
      const type = col.data_type.padEnd(18);
      const nullable = col.is_nullable.padEnd(9);
      const def = (col.column_default || '').substring(0, 20);
      console.log(`${name} ${type} ${nullable} ${def}`);
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Check for required fields
    const columnNames = results.map(r => r.column_name);
    const requiredFields = [
      'approval_status',
      's3_key_raw',
      's3_url_raw',
      'file_size_bytes',
      's3_key_processed',
      's3_url_processed',
      'width',
      'height',
      'processed_at'
    ];
    
    console.log('✓ Required Fields Check:');
    requiredFields.forEach(field => {
      const exists = columnNames.includes(field);
      console.log(`  ${exists ? '✅' : '❌'} ${field}`);
    });
    
    // Count existing assets
    const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM assets');
    console.log(`\n📊 Total assets: ${countResult[0].count}`);
    
    await sequelize.close();
    console.log('\n✅ Schema check complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSchema();