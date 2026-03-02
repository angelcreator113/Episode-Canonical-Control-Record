const { Sequelize } = require('sequelize');
const seq = new Sequelize('episode_metadata', 'postgres', 'Ayanna123', {
  host: '127.0.0.1', port: 5432, dialect: 'postgres', logging: false,
});
(async () => {
  const [chars] = await seq.query(
    "SELECT id, display_name, character_key FROM registry_characters WHERE deleted_at IS NULL LIMIT 10"
  );
  chars.forEach(c => console.log(`${c.id} | ${c.display_name} | ${c.character_key}`));
  await seq.close();
})();
