// Add deleted_at column using sequelize from the project
process.chdir('/home/ubuntu/episode-metadata');
const { Sequelize } = require('/home/ubuntu/episode-metadata/node_modules/sequelize');
const seq = new Sequelize('postgres://postgres:Ayanna123!!@episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com:5432/episode_metadata', {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});
async function run() {
  await seq.query('ALTER TABLE storyteller_echoes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ');
  console.log('Added deleted_at column to storyteller_echoes');
  await seq.close();
}
run().catch(e => { console.error(e); process.exit(1); });
