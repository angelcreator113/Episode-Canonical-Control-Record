const db = require('../src/models');

async function updateMigrationName() {
  try {
    // Update the old migration name to the new one
    await db.sequelize.query(
      'UPDATE "SequelizeMeta" SET name = ? WHERE name = ?',
      {
        replacements: ['20260208000000-create-lala-formula.js', '-create-lala-formula.js'],
        type: db.sequelize.QueryTypes.UPDATE
      }
    );
    
    console.log('✅ Updated SequelizeMeta table');
    
    // Verify the update
    const result = await db.sequelize.query(
      'SELECT name FROM "SequelizeMeta" WHERE name LIKE \'%lala-formula%\' ORDER BY name',
      { type: db.sequelize.QueryTypes.SELECT }
    );
    
    console.log('\nLala formula migrations in database:');
    result.forEach(row => console.log('  -', row.name));
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

updateMigrationName();
