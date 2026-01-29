require('dotenv').config();
const {Sequelize} = require('sequelize');
const s = new Sequelize(process.env.DATABASE_URL, {dialect: 'postgres', logging: false});

async function checkIds() {
  const [eps] = await s.query('SELECT id, title FROM episodes ORDER BY id LIMIT 5');
  console.log('Episodes in DB:');
  eps.forEach(e => console.log(`  ID ${e.id}: ${e.title}`));
  
  const [tmpls] = await s.query('SELECT id, name FROM thumbnail_templates LIMIT 3');
  console.log('\nTemplates in DB:');
  tmpls.forEach(t => console.log(`  ID ${t.id}: ${t.name}`));
  
  await s.close();
}

checkIds();
