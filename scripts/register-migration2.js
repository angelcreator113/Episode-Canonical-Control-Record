const { sequelize } = require('../src/models');
(async () => {
  await sequelize.query(
    `INSERT INTO "SequelizeMeta" (name) VALUES ('20260217000002-fix-episode-number-nullable.js') ON CONFLICT DO NOTHING`
  );
  console.log('Registered migration: 20260217000002-fix-episode-number-nullable.js');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
