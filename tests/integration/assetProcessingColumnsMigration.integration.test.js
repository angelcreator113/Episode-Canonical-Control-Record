/**
 * Integration tests: one guarded migration for three drifted assets columns
 * (Evoni, 2026-11-16; 20261116120000-add-asset-processing-columns).
 *
 * s3_url_no_bg, s3_url_enhanced and processing_metadata are in production
 * and in the model but were in no migration, so a database built by the
 * migration tree lacked them and Asset.findByPk failed there.
 *
 * Each case but the last two runs in a scratch schema of the test database,
 * on its own connection whose search_path is that schema alone, so nothing in
 * the public schema is read or changed. The types and nullability expected
 * are the canon capture's
 * (docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt L135, L140, L141).
 */
jest.unmock('uuid');

const crypto = require('crypto');
const path = require('path');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { Sequelize } = require('sequelize');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261116120000-add-asset-processing-columns');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const THREE = ['processing_metadata', 's3_url_enhanced', 's3_url_no_bg'];
const AS_RECORDED = [
  { column_name: 'processing_metadata', data_type: 'jsonb', is_nullable: 'YES', column_default: null },
  { column_name: 's3_url_enhanced', data_type: 'text', is_nullable: 'YES', column_default: null },
  { column_name: 's3_url_no_bg', data_type: 'text', is_nullable: 'YES', column_default: null },
];

(shouldSkip ? describe.skip : describe)('assets processing columns migration', () => {
  const scratch = [];
  // A schema of its own and a connection that sees nothing else.
  const open = async () => {
    const schema = `asset_cols_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    await sequelize.query(`CREATE SCHEMA ${schema}`);
    const db = new Sequelize(process.env.DATABASE_URL, { logging: false, dialectOptions: { options: `-c search_path=${schema}` }, pool: { max: 1 } });
    scratch.push({ schema, db });
    return { schema, db, qi: db.getQueryInterface() };
  };
  const columns = (schema, names = THREE) => sequelize.query(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = :schema AND table_name = 'assets' AND column_name IN (:names)
      ORDER BY column_name`,
    { replacements: { schema, names }, type: sequelize.QueryTypes.SELECT },
  );
  const allColumns = (schema) => sequelize.query(
    `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema = :schema AND table_name = 'assets' ORDER BY column_name`,
    { replacements: { schema }, type: sequelize.QueryTypes.SELECT },
  );

  afterAll(async () => {
    for (const { schema, db } of scratch) {
      // eslint-disable-next-line no-await-in-loop
      await db.close().catch((err) => console.error('[assetColumns] close:', err.message));
      // eslint-disable-next-line no-await-in-loop
      await sequelize.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch((err) => console.error('[assetColumns] drop:', err.message));
    }
  });

  test('1. a table without them: up adds all three, as recorded (type, nullable, no default), and touches no other column', async () => {
    const { schema, db, qi } = await open();
    await db.query('CREATE TABLE assets (id uuid PRIMARY KEY, name text NOT NULL, s3_url_processed text)');
    await db.query(`INSERT INTO assets (id, name, s3_url_processed) VALUES ('${crypto.randomUUID()}', 'kept', 'https://x/a.png')`);
    const before = await allColumns(schema);
    expect(await columns(schema)).toEqual([]);
    await migration.up(qi, Sequelize);
    expect(await columns(schema)).toEqual(AS_RECORDED);
    expect((await allColumns(schema)).filter((c) => !THREE.includes(c.column_name))).toEqual(before);
    // The row is kept and the new columns are empty on it.
    const [rows] = await db.query('SELECT name, s3_url_processed, s3_url_no_bg, s3_url_enhanced, processing_metadata FROM assets');
    expect(rows).toEqual([{ name: 'kept', s3_url_processed: 'https://x/a.png', s3_url_no_bg: null, s3_url_enhanced: null, processing_metadata: null }]);
  });

  test('2. up twice is harmless: the same columns, no error', async () => {
    const { schema, db, qi } = await open();
    await db.query('CREATE TABLE assets (id uuid PRIMARY KEY, name text)');
    await migration.up(qi, Sequelize);
    await migration.up(qi, Sequelize);
    expect(await columns(schema)).toEqual(AS_RECORDED);
  });

  test('3. a table that already has them, as production does: nothing changes; an existing default and the values survive', async () => {
    const { schema, db, qi } = await open();
    await db.query(`CREATE TABLE assets (id uuid PRIMARY KEY, name text, s3_url_no_bg text, s3_url_enhanced text,
                    processing_metadata jsonb DEFAULT '{}'::jsonb)`);
    const id = crypto.randomUUID();
    await db.query(`INSERT INTO assets (id, name, s3_url_no_bg, s3_url_enhanced, processing_metadata)
                    VALUES ('${id}', 'cut out', 'https://x/no-bg.png', 'https://x/enhanced.png', '{"provider":"removebg","at":"2026-02-01"}'::jsonb)`);
    const before = await allColumns(schema);
    expect(before.find((c) => c.column_name === 'processing_metadata').column_default).toBe("'{}'::jsonb");
    await migration.up(qi, Sequelize);
    await migration.up(qi, Sequelize);
    expect(await allColumns(schema)).toEqual(before);
    const [rows] = await db.query(`SELECT s3_url_no_bg, s3_url_enhanced, processing_metadata FROM assets WHERE id = '${id}'`);
    expect(rows).toEqual([{ s3_url_no_bg: 'https://x/no-bg.png', s3_url_enhanced: 'https://x/enhanced.png', processing_metadata: { provider: 'removebg', at: '2026-02-01' } }]);
    // The existing default still applies to a new row.
    await db.query(`INSERT INTO assets (id, name) VALUES ('${crypto.randomUUID()}', 'new')`);
    const [[fresh]] = await db.query(`SELECT processing_metadata FROM assets WHERE name = 'new'`);
    expect(fresh.processing_metadata).toEqual({});
  });

  test('3b. a table with one of the three, of another type: that column is left as it is and the other two are added', async () => {
    const { schema, db, qi } = await open();
    await db.query('CREATE TABLE assets (id uuid PRIMARY KEY, s3_url_no_bg character varying(500) NOT NULL DEFAULT \'none\')');
    await migration.up(qi, Sequelize);
    const after = await columns(schema);
    expect(after.find((c) => c.column_name === 's3_url_no_bg')).toEqual({ column_name: 's3_url_no_bg', data_type: 'character varying', is_nullable: 'NO', column_default: "'none'::character varying" });
    expect(after.filter((c) => c.column_name !== 's3_url_no_bg')).toEqual(AS_RECORDED.filter((c) => c.column_name !== 's3_url_no_bg'));
  });

  test('4. no assets table: up does not fail and makes nothing', async () => {
    const { schema, qi } = await open();
    await expect(migration.up(qi, Sequelize)).resolves.toBeUndefined();
    const tables = await sequelize.query('SELECT table_name FROM information_schema.tables WHERE table_schema = :schema', { replacements: { schema }, type: sequelize.QueryTypes.SELECT });
    expect(tables).toEqual([]);
  });

  test('5. down changes nothing: the columns and their values are kept', async () => {
    const { schema, db, qi } = await open();
    await db.query('CREATE TABLE assets (id uuid PRIMARY KEY, name text)');
    await migration.up(qi, Sequelize);
    await db.query(`INSERT INTO assets (id, name, s3_url_no_bg, processing_metadata) VALUES ('${crypto.randomUUID()}', 'kept', 'https://x/no-bg.png', '{"a":1}'::jsonb)`);
    const before = await allColumns(schema);
    await expect(migration.down(qi, Sequelize)).resolves.toBeUndefined();
    expect(await allColumns(schema)).toEqual(before);
    const [rows] = await db.query('SELECT s3_url_no_bg, processing_metadata FROM assets');
    expect(rows).toEqual([{ s3_url_no_bg: 'https://x/no-bg.png', processing_metadata: { a: 1 } }]);
  });

  test('6. the test database, built by the migration tree: Asset.findByPk with no columns named answers, where it failed before', async () => {
    // In CI the tree has already run; running up again here is the guarded no-op (and brings an older local database level).
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    expect((await columns('public')).map(({ column_name, data_type, is_nullable }) => ({ column_name, data_type, is_nullable })))
      .toEqual(AS_RECORDED.map(({ column_name, data_type, is_nullable }) => ({ column_name, data_type, is_nullable })));
    const selected = [];
    const spy = jest.spyOn(sequelize, 'query');
    await expect(models.Asset.findByPk(crypto.randomUUID())).resolves.toBeNull();
    for (const [sql] of spy.mock.calls) selected.push(String(sql?.query || sql));
    spy.mockRestore();
    // The read names all three columns itself (the model's whole attribute list), and the database has them.
    const read = selected.find((sql) => /FROM "assets"/.test(sql));
    for (const name of THREE) expect(read).toContain(`"${name}"`);
    // And a row written through the model reads back with them.
    const made = await models.Asset.create({ name: `asset-cols-${crypto.randomUUID().slice(0, 8)}`, asset_type: 'UI_OVERLAY', s3_url_no_bg: 'https://x/no-bg.png', processing_metadata: { provider: 'test' } });
    try {
      const found = await models.Asset.findByPk(made.id);
      expect(found.s3_url_no_bg).toBe('https://x/no-bg.png');
      expect(found.s3_url_enhanced).toBeNull();
      expect(found.processing_metadata).toEqual({ provider: 'test' });
    } finally {
      await sequelize.query('DELETE FROM assets WHERE id = :id', { replacements: { id: made.id } });
    }
  });

  test('7. the schema-agreement check passes with the three entries gone from its baseline, and only those three', () => {
    const root = path.join(__dirname, '../..');
    const baseline = fs.readFileSync(path.join(root, 'scripts/schema-agreement-step2.baseline'), 'utf8').split('\n');
    for (const name of THREE) expect(baseline).not.toContain(`Asset\t${name}\tmissing-column`);
    // No other Asset entry was there to remove, and the neighbours are still listed.
    expect(baseline.filter((l) => l.startsWith('Asset\t'))).toEqual([]);
    expect(baseline).toContain('AssetLabel\t-\tno-table');
    expect(baseline).toContain('EpisodeAsset\tusage_type\tmissing-column');
    const out = execFileSync('node', ['scripts/check-schema-agreement.js', '--step2-baseline', 'scripts/schema-agreement-step2.baseline'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    expect(out).toMatch(/schema-agreement-step2\.baseline: \d+ entries, 0 new, 0 no longer occur/);
  });

  test('the migration adds columns only: no default, no drop, no change of type, and its down is empty', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../src/migrations/20261116120000-add-asset-processing-columns.js'), 'utf8');
    const statements = src.match(/await q\('[^']+'\)/g);
    expect(statements).toEqual([
      "await q('ALTER TABLE assets ADD COLUMN IF NOT EXISTS s3_url_no_bg text')",
      "await q('ALTER TABLE assets ADD COLUMN IF NOT EXISTS s3_url_enhanced text')",
      "await q('ALTER TABLE assets ADD COLUMN IF NOT EXISTS processing_metadata jsonb')",
    ]);
    expect(src).not.toMatch(/\bDEFAULT\b|DROP |ALTER COLUMN|removeColumn|changeColumn|\.sync\(/);
  });
});
