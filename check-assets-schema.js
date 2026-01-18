const { sequelize } = require('./src/models');

async function checkSchema() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'assets' 
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Assets table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSchema();
