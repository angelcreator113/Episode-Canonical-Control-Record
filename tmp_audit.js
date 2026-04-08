require('dotenv').config();
const { Sequelize } = require('sequelize');
const s = new Sequelize(process.env.DATABASE_URL);

async function check() {
  try {
    // Check if there are any soft-deleted characters we can restore
    const [deleted] = await s.query(
      "SELECT id, character_key, deleted_at FROM registry_characters WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 10"
    );
    console.log('Soft-deleted characters:', deleted.length ? JSON.stringify(deleted, null, 2) : 'None found');
  } catch (e) {
    console.log('No soft-deleted characters or table empty');
  }
  
  try {
    // Check SequelizeMeta for recent migrations that might have affected data
    const [migrations] = await s.query(
      "SELECT name FROM \"SequelizeMeta\" WHERE name ILIKE '%character%' OR name ILIKE '%registry%' ORDER BY name"
    );
    console.log('\nCharacter-related migrations:', migrations.length ? migrations.map(m => m.name) : 'None');
  } catch (e) {}
  
  process.exit(0);
}
check();
