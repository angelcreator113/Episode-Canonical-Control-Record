const { Sequelize } = require('sequelize');
const seq = new Sequelize('episode_metadata', 'postgres', 'Ayanna123!!', {
  host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
  port: 5432, dialect: 'postgres', logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

(async () => {
  const [cols] = await seq.query(
    "SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name='storyteller_memories' ORDER BY ordinal_position"
  );
  console.log('=== storyteller_memories columns ===');
  cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`));

  // Check if any memories exist
  const [count] = await seq.query("SELECT COUNT(*) as cnt FROM storyteller_memories");
  console.log('\nTotal memories:', count[0].cnt);

  await seq.close();
})();
