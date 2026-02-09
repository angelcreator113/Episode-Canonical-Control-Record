const db = require('../src/models');

async function updateMigrationName() {
  try {
    // Update all malformed migration names to proper format
    const updates = [
      { old: '-create-lala-formula.js', new: '20260208000000-create-lala-formula.js' },
      { old: '1739041800000-add-game-show-features.js', new: '20260208000001-add-game-show-features.js' },
      { old: '1739041800000-create-lala-formula.js', new: '20260208000002-create-lala-formula.js' }
    ];
    
    for (const update of updates) {
      try {
        await db.sequelize.query(
          'UPDATE "SequelizeMeta" SET name = ? WHERE name = ?',
          {
            replacements: [update.new, update.old],
            type: db.sequelize.QueryTypes.UPDATE
          }
        );
        console.log(`✅ Updated: ${update.old} → ${update.new}`);
      } catch (err) {
        console.log(`⚠️  Skip: ${update.old} (already updated or not found)`);
      }
    }
    
    console.log('\n✅ Migration tracking updated');
    
    // Verify the updates
    const result = await db.sequelize.query(
      'SELECT name FROM "SequelizeMeta" WHERE name LIKE \'%lala-formula%\' OR name LIKE \'%game-show%\' ORDER BY name',
      { type: db.sequelize.QueryTypes.SELECT }
    );
    
    console.log('\nUpdated migrations in database:');
    result.forEach(row => console.log('  -', row.name));
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

updateMigrationName();
