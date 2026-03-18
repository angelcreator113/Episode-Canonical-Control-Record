const db = require('./src/models');
(async () => {
  const [cols] = await db.sequelize.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'storyteller_stories' ORDER BY ordinal_position");
  console.log('COLS:', cols.map(c => c.column_name).join(', '));
  const [idx] = await db.sequelize.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'storyteller_stories'");
  idx.forEach(i => console.log(i.indexname, ':', i.indexdef));
  process.exit(0);
})();
