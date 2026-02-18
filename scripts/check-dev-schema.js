const {sequelize} = require('../src/models');
(async () => {
  // Check if key tables exist
  const [tables] = await sequelize.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
  );
  console.log('=== TABLES ===');
  tables.forEach(t => console.log('  ' + t.tablename));

  // Check assets columns
  const [assetCols] = await sequelize.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='assets' ORDER BY ordinal_position`
  );
  console.log('\n=== ASSETS COLUMNS ===');
  assetCols.forEach(c => console.log('  ' + c.column_name));

  // Check if episode_assets junction table exists
  const [ea] = await sequelize.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='episode_assets' ORDER BY ordinal_position`
  );
  console.log('\n=== EPISODE_ASSETS COLUMNS ===');
  if (ea.length === 0) console.log('  TABLE DOES NOT EXIST');
  ea.forEach(c => console.log('  ' + c.column_name));

  // Check wardrobe table
  const [wCols] = await sequelize.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='wardrobe' ORDER BY ordinal_position`
  );
  console.log('\n=== WARDROBE COLUMNS ===');
  if (wCols.length === 0) console.log('  TABLE DOES NOT EXIST');
  wCols.forEach(c => console.log('  ' + c.column_name));

  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
