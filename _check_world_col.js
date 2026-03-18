const db = require('./src/models');
(async () => {
  const [r] = await db.sequelize.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='characters' ORDER BY ordinal_position"
  );
  const cols = r.map(c => c.column_name);
  console.log('Has world column:', cols.includes('world'));
  console.log('Total columns:', cols.length);
  if (!cols.includes('world')) {
    console.log('Adding world column...');
    await db.sequelize.query('ALTER TABLE characters ADD COLUMN world VARCHAR(100)');
    console.log('Done - world column added');
  } else {
    console.log('world column already exists');
  }
  await db.sequelize.close();
})().catch(e => { console.error(e.message); process.exit(1); });
