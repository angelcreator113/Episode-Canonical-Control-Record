const { sequelize } = require('./src/models');

(async () => {
  try {
    console.log('🔍 Checking thumbnail_templates table structure...\n');
    
    // Get all columns
    const [columns] = await sequelize.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'thumbnail_templates'
      ORDER BY ordinal_position;
    `);
    
    console.log('📊 Columns:');
    columns.forEach(col => {
      console.log(`  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(25)} ${col.is_nullable} ${col.column_default || ''}`);
    });
    
    // Get all constraints
    const [constraints] = await sequelize.query(`
      SELECT
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      LEFT JOIN information_schema.constraint_column_usage AS ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'thumbnail_templates';
    `);
    
    console.log('\n🔗 Constraints:');
    constraints.forEach(c => {
      console.log(`  ${c.constraint_name}: ${c.constraint_type} (${c.column_name}${c.foreign_table_name ? ' → ' + c.foreign_table_name : ''})`);
    });
    
    // Get all indexes
    const [indexes] = await sequelize.query(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'thumbnail_templates';
    `);
    
    console.log('\n📑 Indexes:');
    indexes.forEach(idx => {
      console.log(`  ${idx.indexname}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
