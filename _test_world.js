const db = require('./src/models');
(async () => {
  try {
    const [tables] = await db.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'world%' OR table_name LIKE 'intimate%' OR table_name LIKE 'scene_%' OR table_name LIKE 'generation_%' ORDER BY 1"
    );
    console.log('Tables found:', tables.map(x => x.table_name));

    // Try the actual query the route uses
    console.log('\n--- Testing /world/characters query ---');
    const [chars] = await db.sequelize.query('SELECT * FROM world_characters WHERE 1=1 ORDER BY character_type, name LIMIT 3');
    console.log('Characters found:', chars.length);

    console.log('\n--- Testing /world/scenes query ---');
    const [scenes] = await db.sequelize.query('SELECT * FROM intimate_scenes ORDER BY created_at DESC LIMIT 3');
    console.log('Scenes found:', scenes.length);

    console.log('\n--- Testing /world/tension-check related query ---');
    const [triggered] = await db.sequelize.query("SELECT * FROM world_characters WHERE current_tension IS NOT NULL AND current_tension != '' AND intimate_eligible = true LIMIT 3");
    console.log('Triggered found:', triggered.length);

  } catch (e) {
    console.error('ERROR:', e.message);
    console.error('Full error:', e);
  } finally {
    process.exit();
  }
})();
