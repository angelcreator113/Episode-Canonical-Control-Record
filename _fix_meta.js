require('dotenv').config({path:'/home/ubuntu/episode-metadata/.env'});
const {Sequelize} = require('/home/ubuntu/episode-metadata/node_modules/sequelize');
const s = new Sequelize(process.env.DATABASE_URL, {
  dialect:'postgres',
  dialectOptions:{ssl:{rejectUnauthorized:false}},
  logging:false
});
s.query('INSERT INTO "SequelizeMeta" (name) VALUES (\'20260323000000-create-generation-jobs.js\') ON CONFLICT DO NOTHING')
  .then(() => { console.log('Inserted OK'); })
  .catch(e => { console.error('Error:', e.message); })
  .finally(() => s.close());
