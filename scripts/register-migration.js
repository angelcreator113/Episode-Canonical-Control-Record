const {sequelize} = require('../src/models');
sequelize.query(
  `INSERT INTO "SequelizeMeta" (name) VALUES ('20260217000001-fix-wardrobe-schema-gaps.js') ON CONFLICT DO NOTHING`
).then(() => { console.log('Registered'); process.exit(0); })
.catch(e => { console.error(e.message); process.exit(1); });
