/**
 * Integration Tests - 20260927210000-add-registry-characters-world.js
 * (F-Reg-2 Fix Plan v1.1, Task #2111).
 *
 * The test database is built by the migration tree (CI runs `npm run
 * migrate:up` first), so registry_characters.world and its enum type here are
 * the ones this migration made. These tests compare them, as catalog data,
 * with Evoni's production read of 2026-09-27 (F-Reg-2_Fix_Plan_v1.1.md §2),
 * then run the migration again over rows that hold values and check that
 * nothing changes. A stand-in query interface covers the one refusal: an
 * existing type whose labels differ.
 */
const { sequelize } = require('../../src/models');
const migration = require('../../src/migrations/20260927210000-add-registry-characters-world');
const crypto = require('crypto');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

// Evoni's production read, 2026-09-27, as data.
const PRODUCTION_COLUMN = {
  column_name: 'world',
  data_type: 'USER-DEFINED',
  udt_name: 'enum_registry_characters_world',
  is_nullable: 'YES',
  column_default: null,
};
const PRODUCTION_LABELS = ['book-1', 'lalaverse', 'series-2'];

const readColumn = () => q(
  `SELECT column_name, data_type, udt_name, is_nullable, column_default
     FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'registry_characters' AND column_name = 'world'`
);
const readLabels = async () => (await q(
  `SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'enum_registry_characters_world' ORDER BY e.enumsortorder`
)).map(r => r.enumlabel);

(shouldSkip ? describe.skip : describe)('20260927210000-add-registry-characters-world (F-Reg-2 Fix Plan v1.1)', () => {
  it('creates the column and its enum exactly as production has them', async () => {
    const column = await readColumn();
    const labels = await readLabels();
    // Printed so the PR can paste the comparison.
    console.log('[world migration] column:', JSON.stringify(column), 'labels:', JSON.stringify(labels));
    expect(column).toEqual([PRODUCTION_COLUMN]);
    expect(labels).toEqual(PRODUCTION_LABELS);
  });

  it('changes nothing when run again over rows that hold values', async () => {
    const ids = { registry: crypto.randomUUID(), a: crypto.randomUUID(), b: crypto.randomUUID(), c: crypto.randomUUID() };
    await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:registry, 'World migration test', NOW(), NOW())`, ids);
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, world, created_at, updated_at) VALUES
                 (:a, :registry, :ka, 'A', 'book-1', NOW(), NOW()),
                 (:b, :registry, :kb, 'B', 'series-2', NOW(), NOW()),
                 (:c, :registry, :kc, 'C', NULL, NOW(), NOW())`,
      { ...ids, ka: `wm-a-${ids.a.slice(0, 8)}`, kb: `wm-b-${ids.b.slice(0, 8)}`, kc: `wm-c-${ids.c.slice(0, 8)}` });
    try {
      const readRows = () => q(`SELECT id, world::text AS world, updated_at FROM registry_characters WHERE registry_id = :registry ORDER BY id`, ids);
      const before = { column: await readColumn(), labels: await readLabels(), rows: await readRows() };

      await migration.up(sequelize.getQueryInterface());
      await migration.up(sequelize.getQueryInterface());

      const after = { column: await readColumn(), labels: await readLabels(), rows: await readRows() };
      expect(after).toEqual(before);
      expect(after.rows.map(r => r.world).sort()).toEqual(['book-1', 'series-2', null].sort());
    } finally {
      await run(`DELETE FROM character_registries WHERE id = :registry`, ids); // cascades registry characters
    }
  });

  it('refuses, without altering anything, an existing type whose labels differ', async () => {
    const statements = [];
    const fakeSequelize = {
      QueryTypes: sequelize.QueryTypes,
      transaction: async (fn) => fn({}),
      query: async (sql) => {
        statements.push(sql.trim().split(/\s+/).slice(0, 3).join(' '));
        if (/FROM pg_type/.test(sql)) return [{ enumlabel: 'book-1' }, { enumlabel: 'series-2' }, { enumlabel: 'lalaverse' }];
        return [];
      },
    };

    await expect(migration.up({ sequelize: fakeSequelize }))
      .rejects.toThrow('type enum_registry_characters_world exists with labels [book-1, series-2, lalaverse], expected [book-1, lalaverse, series-2] in that order');
    expect(statements).toEqual(['SELECT e.enumlabel FROM']);
  });

  it('has a down that changes nothing', async () => {
    const before = { column: await readColumn(), labels: await readLabels() };
    await migration.down(sequelize.getQueryInterface());
    expect({ column: await readColumn(), labels: await readLabels() }).toEqual(before);
  });
});
