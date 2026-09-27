/**
 * Integration Tests - 20260927000000-create-episode-wardrobe.js
 * (F-Ward-1 Fix Plan v1.0 O1, Task #2087).
 *
 * The test database is built by the migration tree (CI runs `npm run
 * migrate:up` first), so episode_wardrobe here is the one that migration made.
 * These tests compare it, as catalog data, with Evoni's production read of
 * 2026-09-27 (F-Ward-1_Fix_Plan_v1.0.md §2.1 and §2.2, plus her lengths read
 * of the same day), then run the migration again, on this table and on a
 * differently shaped one, and check that it changes nothing.
 */
const { sequelize } = require('../../src/models');
const migration = require('../../src/migrations/20260927000000-create-episode-wardrobe');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

// Evoni's production read, 2026-09-27, as data: [column, data_type, is_nullable,
// column_default, character_maximum_length].
const PRODUCTION_COLUMNS = [
  ['id', 'uuid', 'NO', 'gen_random_uuid()', null],
  ['episode_id', 'uuid', 'NO', null, null],
  ['wardrobe_id', 'uuid', 'NO', null, null],
  ['scene', 'character varying', 'YES', null, 255],
  ['worn_at', 'timestamp with time zone', 'YES', null, null],
  ['notes', 'text', 'YES', null, null],
  ['created_at', 'timestamp with time zone', 'YES', 'now()', null],
  ['updated_at', 'timestamp with time zone', 'YES', 'now()', null],
  ['scene_id', 'uuid', 'YES', null, null],
  ['is_episode_favorite', 'boolean', 'NO', 'false', null],
  ['times_worn', 'integer', 'NO', '1', null],
  ['approval_status', 'character varying', 'YES', "'pending'::character varying", 50],
  ['approved_by', 'character varying', 'YES', null, 255],
  ['approved_at', 'timestamp with time zone', 'YES', null, null],
  ['rejection_reason', 'text', 'YES', null, null],
  ['deleted_at', 'timestamp with time zone', 'YES', null, null],
];

const PRODUCTION_CONSTRAINTS = [
  ['episode_wardrobe_episode_id_fkey', 'FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE'],
  ['episode_wardrobe_pkey', 'PRIMARY KEY (id)'],
  ['episode_wardrobe_scene_id_fkey', 'FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE SET NULL'],
  ['episode_wardrobe_wardrobe_id_fkey', 'FOREIGN KEY (wardrobe_id) REFERENCES wardrobe(id) ON DELETE CASCADE'],
  ['unique_episode_wardrobe', 'UNIQUE (episode_id, wardrobe_id)'],
];

const PRODUCTION_INDEXES = [
  ['episode_wardrobe_episode_id', 'CREATE INDEX episode_wardrobe_episode_id ON public.episode_wardrobe USING btree (episode_id)'],
  ['episode_wardrobe_pkey', 'CREATE UNIQUE INDEX episode_wardrobe_pkey ON public.episode_wardrobe USING btree (id)'],
  ['episode_wardrobe_wardrobe_id', 'CREATE INDEX episode_wardrobe_wardrobe_id ON public.episode_wardrobe USING btree (wardrobe_id)'],
  ['idx_episode_wardrobe_favorites', 'CREATE INDEX idx_episode_wardrobe_favorites ON public.episode_wardrobe USING btree (is_episode_favorite) WHERE (is_episode_favorite = true)'],
  ['idx_episode_wardrobe_scene_id', 'CREATE INDEX idx_episode_wardrobe_scene_id ON public.episode_wardrobe USING btree (scene_id)'],
  ['idx_episode_wardrobe_worn_at', 'CREATE INDEX idx_episode_wardrobe_worn_at ON public.episode_wardrobe USING btree (worn_at)'],
  ['unique_episode_wardrobe', 'CREATE UNIQUE INDEX unique_episode_wardrobe ON public.episode_wardrobe USING btree (episode_id, wardrobe_id)'],
];

async function catalog(table = 'episode_wardrobe') {
  const columns = (await q(
    `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
     FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :table
     ORDER BY ordinal_position`, { table }
  )).map(r => [r.column_name, r.data_type, r.is_nullable, r.column_default, r.character_maximum_length]);
  const constraints = (await q(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE conrelid = to_regclass(:qualified) ORDER BY conname`, { qualified: `public.${table}` }
  )).map(r => [r.conname, r.def]);
  const indexes = (await q(
    `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = :table ORDER BY indexname`,
    { table }
  )).map(r => [r.indexname, r.indexdef]);
  return { columns, constraints, indexes };
}

const quietly = async (fn) => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try { return await fn(); } finally { log.mockRestore(); }
};

(shouldSkip ? describe.skip : describe)('20260927000000-create-episode-wardrobe (Task #2087)', () => {
  test('(a) a migration-built episode_wardrobe equals production\'s, column by column, constraint by constraint, index by index', async () => {
    const got = await catalog();
    expect(got.columns).toEqual(PRODUCTION_COLUMNS);
    expect(got.constraints).toEqual(PRODUCTION_CONSTRAINTS);
    expect(got.indexes).toEqual(PRODUCTION_INDEXES);
  });

  test('(b) running the migration again changes nothing', async () => {
    const before = await catalog();
    await quietly(() => migration.up(sequelize.getQueryInterface()));
    expect(await catalog()).toEqual(before);
  });

  test('(c) where episode_wardrobe already exists, with rows and another shape, the migration leaves it exactly as it was', async () => {
    // Swap the migration-built table aside and put a differently shaped
    // episode_wardrobe (canon's 11 columns before Deploy AG) in its place.
    await run('ALTER TABLE episode_wardrobe RENAME TO episode_wardrobe_2087_aside');
    try {
      await run(`CREATE TABLE episode_wardrobe (
        id uuid NOT NULL, episode_id uuid NOT NULL, wardrobe_id uuid NOT NULL,
        scene character varying(255), scene_id uuid, notes text,
        worn_at timestamp with time zone, times_worn integer NOT NULL DEFAULT 1,
        is_episode_favorite boolean NOT NULL DEFAULT false,
        created_at timestamp with time zone, updated_at timestamp with time zone,
        CONSTRAINT test_2087_legacy_pkey PRIMARY KEY (id))`);
      await run(`INSERT INTO episode_wardrobe (id, episode_id, wardrobe_id, notes, times_worn)
                 VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'test-2087 row', 3)`);
      const before = await catalog();
      const rowsBefore = await q('SELECT * FROM episode_wardrobe ORDER BY id');

      await quietly(() => migration.up(sequelize.getQueryInterface()));

      expect(await catalog()).toEqual(before);
      expect(await q('SELECT * FROM episode_wardrobe ORDER BY id')).toEqual(rowsBefore);
      expect(before.columns).toHaveLength(11);
    } finally {
      await run('DROP TABLE IF EXISTS episode_wardrobe');
      await run('ALTER TABLE episode_wardrobe_2087_aside RENAME TO episode_wardrobe');
    }
    // The real table is back, unchanged.
    expect((await catalog()).columns).toEqual(PRODUCTION_COLUMNS);
  });

  test('down is a no-op: the table and its catalog are unchanged', async () => {
    const before = await catalog();
    await quietly(() => migration.down(sequelize.getQueryInterface()));
    expect(await catalog()).toEqual(before);
  });
});
