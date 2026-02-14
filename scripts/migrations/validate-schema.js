const db = require('./src/models');

async function validateSchema() {
  try {
    console.log('🔍 Validating database schema...\n');
    
    // Authenticate
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful\n');

    // Check layer_assets timing columns
    console.log('📋 Checking layer_assets table for timing columns...');
    const layerAssetsResult = await db.sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name='layer_assets'
      AND (column_name LIKE '%point%' 
           OR column_name='transition_in' 
           OR column_name='transition_out' 
           OR column_name='animation_type')
      ORDER BY ordinal_position
    `);

    if (layerAssetsResult[0].length > 0) {
      console.log('✅ Timing columns found in layer_assets:\n');
      console.table(layerAssetsResult[0]);
    } else {
      console.warn('⚠️  No timing columns found in layer_assets');
    }

    // Check decision_logs table exists
    console.log('\n📋 Checking decision_logs table...');
    const decisionLogsCheck = await db.sequelize.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name='decision_logs'
    `);

    if (decisionLogsCheck[0].length > 0) {
      console.log('✅ decision_logs table exists\n');

      // Check decision_logs columns
      const decisionLogsColumns = await db.sequelize.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name='decision_logs'
        ORDER BY ordinal_position
      `);

      console.log('✅ decision_logs columns:\n');
      console.table(decisionLogsColumns[0]);
    } else {
      console.warn('⚠️  decision_logs table not found');
    }

    // Check layer_assets indexes
    console.log('\n📋 Checking layer_assets indexes...');
    const indexesResult = await db.sequelize.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename='layer_assets'
      AND indexname LIKE '%timing%'
    `);

    if (indexesResult[0].length > 0) {
      console.log('✅ Timing indexes found:\n');
      console.table(indexesResult[0]);
    } else {
      console.warn('⚠️  No timing indexes found');
    }

    console.log('\n✅ Schema validation complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

validateSchema();
