const { Sequelize } = require('sequelize');
const seq = new Sequelize('episode_metadata', 'postgres', 'Ayanna123!!', {
  host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
  port: 5432, dialect: 'postgres', dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }, logging: false
});
(async () => {
  const [shows] = await seq.query('SELECT id, name FROM shows LIMIT 5');
  console.log('SHOWS:', JSON.stringify(shows));
  const [regs] = await seq.query('SELECT id, title, show_id FROM character_registries LIMIT 5');
  console.log('REGISTRIES:', JSON.stringify(regs));
  const [univs] = await seq.query('SELECT id, name FROM universes LIMIT 5');
  console.log('UNIVERSES:', JSON.stringify(univs));
  const [books] = await seq.query('SELECT id, title, show_id FROM storyteller_books LIMIT 5');
  console.log('BOOKS:', JSON.stringify(books));
  await seq.close();
})();
