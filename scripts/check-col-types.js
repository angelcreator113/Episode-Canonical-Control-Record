const {sequelize} = require('../src/models');
(async () => {
  const [cols] = await sequelize.query(
    `SELECT column_name, data_type, udt_name 
     FROM information_schema.columns 
     WHERE table_name='assets' AND column_name IN ('show_id','episode_id','asset_scope','category') 
     ORDER BY column_name`
  );
  console.log('=== Asset column types ===');
  cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (${c.udt_name})`));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
