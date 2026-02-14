require('dotenv').config();
const {Sequelize} = require('sequelize');
const s = new Sequelize(process.env.DATABASE_URL, {dialect: 'postgres', logging: false});

async function check() {
  const [cols] = await s.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'thumbnail_templates' ORDER BY ordinal_position");
  console.log('thumbnail_templates columns:');
  cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
  await s.close();
}

check();
