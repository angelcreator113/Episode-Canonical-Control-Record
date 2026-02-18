const {sequelize} = require('../src/models');
(async () => {
  console.log('=== Fixing assets.show_id type (int4 → uuid) ===\n');

  // 1. Drop any existing foreign key constraints on show_id
  const [fks] = await sequelize.query(`
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'assets'
      AND kcu.column_name = 'show_id'
      AND tc.constraint_type = 'FOREIGN KEY'
  `);
  for (const fk of fks) {
    console.log('  Dropping FK:', fk.constraint_name);
    await sequelize.query(`ALTER TABLE assets DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`);
  }

  // 2. Drop any indexes that reference show_id
  const [idxs] = await sequelize.query(`
    SELECT indexname FROM pg_indexes 
    WHERE tablename = 'assets' AND indexdef LIKE '%show_id%'
  `);
  for (const idx of idxs) {
    console.log('  Dropping index:', idx.indexname);
    await sequelize.query(`DROP INDEX IF EXISTS "${idx.indexname}"`);
  }

  // 3. Clear any existing data in show_id (can't cast int to uuid)
  const [count] = await sequelize.query(
    `SELECT COUNT(*) as c FROM assets WHERE show_id IS NOT NULL`
  );
  console.log(`  Assets with show_id set: ${count[0].c}`);
  if (parseInt(count[0].c) > 0) {
    console.log('  Clearing show_id values (cannot cast int → uuid)...');
    await sequelize.query(`UPDATE assets SET show_id = NULL`);
  }

  // 4. Alter column type from INTEGER to UUID
  console.log('  Altering show_id from INTEGER to UUID...');
  await sequelize.query(`ALTER TABLE assets ALTER COLUMN show_id TYPE UUID USING show_id::text::uuid`);
  console.log('  ✅ show_id is now UUID');

  // 5. Recreate the index
  await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_assets_show_category ON assets(show_id, category)`);
  console.log('  ✅ Recreated idx_assets_show_category');

  // 6. Verify
  const [verify] = await sequelize.query(`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_name='assets' AND column_name='show_id'
  `);
  console.log(`  Verification: show_id is now ${verify[0].data_type} (${verify[0].udt_name})`);

  console.log('\n=== Done! ===');
  process.exit(0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
