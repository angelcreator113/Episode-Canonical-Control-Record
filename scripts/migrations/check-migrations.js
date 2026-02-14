const { sequelize } = require('./src/models');

async function checkMigrations() {
  try {
    const [results] = await sequelize.query('SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 10');
    console.log('Last 10 migrations run:');
    results.forEach(row => console.log(`  ${row.name}`));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkMigrations();
