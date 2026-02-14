const { sequelize } = require('./src/models');

async function checkSchemaContext() {
  try {
    console.log('Checking database schema context...\n');
    
    // Check current search path
    const searchPathResult = await sequelize.query('SHOW search_path', {
      type: sequelize.QueryTypes.SELECT
    });
    console.log('✓ Current search_path:',searchPathResult[0].search_path);
    
    // Check current schema
    const schemaResult = await sequelize.query('SELECT current_schema()', {
      type: sequelize.QueryTypes.SELECT
    });
    console.log('✓ Current schema:', schemaResult[0].current_schema);
    
    // Check if scenes table exists in public schema
    const publicScenesResult = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'scenes'
      ) as exists`,
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log('✓ Scenes table in public schema:', publicScenesResult[0].exists);
    
    // List all schemas that have a scenes table
    const allScenesResult = await sequelize.query(
      `SELECT table_schema 
       FROM information_schema.tables 
       WHERE table_name = 'scenes'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log('✓ Schemas containing scenes table:', allScenesResult.map(r => r.table_schema));
    
    // Try querying scenes with different qualifications
    console.log('\nTesting different query approaches:');
    
    try {
      const count1 = await sequelize.query('SELECT COUNT(*) FROM scenes', {
        type: sequelize.QueryTypes.SELECT
      });
      console.log('  ✓ SELECT FROM scenes:', count1[0].count);
    } catch (err) {
      console.log('  ✗ SELECT FROM scenes:', err.message);
    }
    
    try {
      const count2 = await sequelize.query('SELECT COUNT(*) FROM public.scenes', {
        type: sequelize.QueryTypes.SELECT
      });
      console.log('  ✓ SELECT FROM public.scenes:', count2[0].count);
    } catch (err) {
      console.log('  ✗ SELECT FROM public.scenes:', err.message);
    }
    
    try {
      const count3 = await sequelize.query('SELECT COUNT(*) FROM "scenes"', {
        type: sequelize.QueryTypes.SELECT
      });
      console.log('  ✓ SELECT FROM "scenes":', count3[0].count);
    } catch (err) {
      console.log('  ✗ SELECT FROM "scenes":', err.message);
    }
    
    try {
      const count4 = await sequelize.query('SELECT COUNT(*) FROM "public"."scenes"', {
        type: sequelize.QueryTypes.SELECT
      });
      console.log('  ✓ SELECT FROM "public"."scenes":', count4[0].count);
    } catch (err) {
      console.log('  ✗ SELECT FROM "public"."scenes":', err.message);
    }
    
    await sequelize.close();
    console.log('\n✓ Schema context check complete');
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

checkSchemaContext();
