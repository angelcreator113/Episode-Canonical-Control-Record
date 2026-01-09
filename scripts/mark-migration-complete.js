require('dotenv').config();
const { sequelize } = require('../src/models');

async function markComplete() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');

    await sequelize.query(`
      INSERT INTO "SequelizeMeta" (name) 
      VALUES ('20260108200000-create-episode-templates.js') 
      ON CONFLICT DO NOTHING;
    `);

    console.log('✅ Migration marked as complete');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
}

markComplete();