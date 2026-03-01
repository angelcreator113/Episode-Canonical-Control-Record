const { Sequelize } = require('sequelize');
const s = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
  }
);

(async () => {
  const [ew] = await s.query("SELECT column_name FROM information_schema.columns WHERE table_name='episode_wardrobe' ORDER BY ordinal_position");
  console.log('EPISODE_WARDROBE:', ew.map(c => c.column_name).join(', '));
  await s.close();
})().catch(e => { console.error(e.message); process.exit(1); });
