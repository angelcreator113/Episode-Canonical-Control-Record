const { sequelize } = require('./src/models');

async function checkTables() {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected');

    const [results] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('scene_library', 'episode_scenes')
      ORDER BY table_name
    `);

    console.log('\nTables found:', results.length);
    results.forEach(row => console.log(`  - ${row.table_name}`));

    if (results.length === 0) {
      console.log('\n❌ No scene library tables found! Need to run migrations.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkTables();
