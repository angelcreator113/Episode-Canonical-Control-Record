/**
 * 20260926000000-dedupe-episode-wardrobe-indexes (Task #1933).
 *
 * Evoni's production read (ATTESTED 2026-09-25, on #1930): episode_wardrobe
 * has 12 indexes; episode_id and wardrobe_id are each indexed three times,
 * and UNIQUE (episode_id, wardrobe_id) exists twice
 * (episode_wardrobe_episode_id_wardrobe_id_key, unique_episode_wardrobe).
 * The single-column names are not in her read, so the fixture uses the
 * candidate names the repo's scripts and dumps create, and the migration
 * must find them by definition, not by name.
 *
 * queryInterface is a small in-memory pg catalog that answers the
 * statements the migration issues, and refuses DROP INDEX on an index a
 * constraint owns, as Postgres does. No database.
 */
const migration = require('../../../src/migrations/20260926000000-dedupe-episode-wardrobe-indexes');

const def = (name, cols, { unique = false, where = '' } = {}) =>
  `CREATE ${unique ? 'UNIQUE ' : ''}INDEX ${name} ON public.episode_wardrobe USING btree (${cols})${where}`;

/** Evoni's 12, with the repo's candidate names for the unknown six. */
function evoniTwelve() {
  return [
    { indexname: 'episode_wardrobe_pkey', indexdef: def('episode_wardrobe_pkey', 'id', { unique: true }), conname: 'episode_wardrobe_pkey', contype: 'p', condef: 'PRIMARY KEY (id)' },
    { indexname: 'episode_wardrobe_episode_id_wardrobe_id_key', indexdef: def('episode_wardrobe_episode_id_wardrobe_id_key', 'episode_id, wardrobe_id', { unique: true }), conname: 'episode_wardrobe_episode_id_wardrobe_id_key', contype: 'u', condef: 'UNIQUE (episode_id, wardrobe_id)' },
    { indexname: 'unique_episode_wardrobe', indexdef: def('unique_episode_wardrobe', 'episode_id, wardrobe_id', { unique: true }), conname: 'unique_episode_wardrobe', contype: 'u', condef: 'UNIQUE (episode_id, wardrobe_id)' },
    { indexname: 'episode_wardrobe_episode_id', indexdef: def('episode_wardrobe_episode_id', 'episode_id') },
    { indexname: 'idx_episode_wardrobe_episode_id', indexdef: def('idx_episode_wardrobe_episode_id', 'episode_id') },
    { indexname: 'episode_wardrobe_episode_id_idx', indexdef: def('episode_wardrobe_episode_id_idx', 'episode_id') },
    { indexname: 'episode_wardrobe_wardrobe_id', indexdef: def('episode_wardrobe_wardrobe_id', 'wardrobe_id') },
    { indexname: 'idx_episode_wardrobe_wardrobe_id', indexdef: def('idx_episode_wardrobe_wardrobe_id', 'wardrobe_id') },
    { indexname: 'episode_wardrobe_wardrobe_id_idx', indexdef: def('episode_wardrobe_wardrobe_id_idx', 'wardrobe_id') },
    { indexname: 'idx_episode_wardrobe_scene_id', indexdef: def('idx_episode_wardrobe_scene_id', 'scene_id') },
    { indexname: 'idx_episode_wardrobe_worn_at', indexdef: def('idx_episode_wardrobe_worn_at', 'worn_at') },
    { indexname: 'idx_episode_wardrobe_favorites', indexdef: def('idx_episode_wardrobe_favorites', 'is_episode_favorite', { where: ' WHERE (is_episode_favorite = true)' }) },
  ];
}

function makeCatalog(initial, { tableExists = true } = {}) {
  let rows = initial.map((r) => ({ conname: null, contype: null, condef: null, comment: null, ...r }));
  const statements = [];
  const unq = (s) => s.replace(/^"|"$/g, '').replace(/""/g, '"');
  const find = (name) => rows.find((r) => r.indexname === name);
  const renameDef = (d, from, to) => d.replace(`INDEX ${from} ON`, `INDEX ${to} ON`);

  const query = jest.fn(async (sql, opts = {}) => {
    statements.push(sql);
    const r = opts.replacements || {};
    let m;
    if (/FROM pg_indexes/.test(sql)) return [rows.map((x) => ({ ...x })).sort((a, b) => a.indexname.localeCompare(b.indexname))];
    if (/FROM pg_class WHERE relname = :name/.test(sql)) return [find(r.name) ? [{ '?column?': 1 }] : []];
    if (/FROM pg_constraint WHERE conname = :name/.test(sql)) return [rows.some((x) => x.conname === r.name) ? [{ '?column?': 1 }] : []];
    if ((m = /^DROP INDEX IF EXISTS ("(?:[^"]|"")+")$/.exec(sql))) {
      const row = find(unq(m[1]));
      if (row && row.conname) throw new Error(`cannot drop index ${row.indexname} because constraint ${row.conname} on table episode_wardrobe requires it`);
      rows = rows.filter((x) => x !== row);
      return [[], 0];
    }
    if ((m = /^ALTER TABLE "episode_wardrobe" DROP CONSTRAINT IF EXISTS ("(?:[^"]|"")+")$/.exec(sql))) {
      rows = rows.filter((x) => x.conname !== unq(m[1]));
      return [[], 0];
    }
    if ((m = /^ALTER INDEX ("(?:[^"]|"")+") RENAME TO ("(?:[^"]|"")+")$/.exec(sql)) || (m = /^ALTER TABLE "episode_wardrobe" RENAME CONSTRAINT ("(?:[^"]|"")+") TO ("(?:[^"]|"")+")$/.exec(sql))) {
      const [from, to] = [unq(m[1]), unq(m[2])];
      const row = find(from);
      if (!row) throw new Error(`relation "${from}" does not exist`);
      if (/^ALTER INDEX/.test(sql) && row.conname) {
        row.conname = to; // Postgres renames the owning constraint with the index
      } else if (row.conname) {
        row.conname = to;
      }
      row.indexdef = renameDef(row.indexdef, from, to);
      row.indexname = to;
      return [[], 0];
    }
    if ((m = /^CREATE (UNIQUE )?INDEX (?:IF NOT EXISTS )?("?[\w]+"?) ON ("?[\w.]+"?) (?:USING btree )?\(([^)]*)\)(.*)$/.exec(sql))) {
      const name = unq(m[2]);
      if (!find(name)) {
        const cols = m[4].split(',').map((c) => unq(c.trim())).join(', ');
        rows.push({ indexname: name, indexdef: def(name, cols, { unique: !!m[1], where: m[5] }), conname: null, contype: null, condef: null, comment: null });
      }
      return [[], 0];
    }
    if ((m = /^ALTER TABLE "episode_wardrobe" ADD CONSTRAINT ("(?:[^"]|"")+") UNIQUE \(([^)]*)\)$/.exec(sql))) {
      const name = unq(m[1]);
      rows.push({ indexname: name, indexdef: def(name, m[2], { unique: true }), conname: name, contype: 'u', condef: `UNIQUE (${m[2]})`, comment: null });
      return [[], 0];
    }
    if ((m = /^COMMENT ON INDEX ("(?:[^"]|"")+") IS ([\s\S]*)$/.exec(sql))) {
      const row = find(unq(m[1]));
      if (!row) throw new Error('no such index');
      row.comment = m[2] === 'NULL' ? null : m[2].slice(1, -1).replace(/''/g, "'");
      return [[], 0];
    }
    throw new Error(`fake catalog: unhandled statement: ${sql}`);
  });

  const sequelize = {
    query,
    transaction: async (cb) => cb('t'),
  };
  return {
    statements,
    get rows() { return rows; },
    names: () => rows.map((x) => x.indexname).sort(),
    queryInterface: { sequelize, tableExists: jest.fn(async () => tableExists) },
  };
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const onCols = (cat, cols, unique) => cat.rows.filter((r) => {
  const p = migration.parseIndexDef(r.indexdef);
  return p && p.unique === unique && p.columns.join(',') === cols;
});

describe('20260926000000-dedupe-episode-wardrobe-indexes (Task #1933)', () => {
  test("up leaves exactly one of each on Evoni's 12 and touches nothing else", async () => {
    const cat = makeCatalog(evoniTwelve());
    await migration.up(cat.queryInterface);

    expect(cat.names()).toEqual([
      'episode_wardrobe_episode_id',
      'episode_wardrobe_pkey',
      'episode_wardrobe_wardrobe_id',
      'idx_episode_wardrobe_favorites',
      'idx_episode_wardrobe_scene_id',
      'idx_episode_wardrobe_worn_at',
      'unique_episode_wardrobe',
    ]);
    expect(onCols(cat, 'episode_id,wardrobe_id', true)).toHaveLength(1);
    expect(onCols(cat, 'episode_id', false)).toHaveLength(1);
    expect(onCols(cat, 'wardrobe_id', false)).toHaveLength(1);

    const drops = cat.statements.filter((s) => /\bDROP\b/.test(s));
    expect(drops).toHaveLength(5);
    for (const s of drops) expect(s).toMatch(/IF EXISTS/);
    expect(drops).toContain('ALTER TABLE "episode_wardrobe" DROP CONSTRAINT IF EXISTS "episode_wardrobe_episode_id_wardrobe_id_key"');
  });

  test('down recreates exactly what up dropped', async () => {
    const before = evoniTwelve();
    const cat = makeCatalog(before);
    await migration.up(cat.queryInterface);
    await migration.down(cat.queryInterface);

    const shape = (rows) => rows.map((r) => [r.indexname, r.indexdef, r.conname || null]).sort();
    expect(shape(cat.rows)).toEqual(shape(before.map((r) => ({ conname: null, ...r }))));
    expect(cat.rows.every((r) => r.comment === null)).toBe(true);
  });

  test('when no index has the model name, the first by name is kept and renamed; down renames it back', async () => {
    const initial = evoniTwelve()
      .filter((r) => !['episode_wardrobe_episode_id', 'unique_episode_wardrobe'].includes(r.indexname))
      .concat([{ indexname: 'idx_episode_wardrobe_episode', indexdef: def('idx_episode_wardrobe_episode', 'episode_id') }]);
    const cat = makeCatalog(initial);
    await migration.up(cat.queryInterface);

    expect(cat.names()).toContain('episode_wardrobe_episode_id');
    expect(cat.names()).toContain('unique_episode_wardrobe');
    expect(cat.statements).toContain('ALTER INDEX "episode_wardrobe_episode_id_idx" RENAME TO "episode_wardrobe_episode_id"');
    expect(cat.statements).toContain('ALTER TABLE "episode_wardrobe" RENAME CONSTRAINT "episode_wardrobe_episode_id_wardrobe_id_key" TO "unique_episode_wardrobe"');
    expect(onCols(cat, 'episode_id', false)).toHaveLength(1);

    await migration.down(cat.queryInterface);
    expect(cat.names()).toEqual(initial.map((r) => r.indexname).sort());
  });

  test('a missing index is created, and down drops it', async () => {
    const initial = evoniTwelve().filter((r) => !/wardrobe_id(_idx)?$/.test(r.indexname) || /episode_id_wardrobe_id/.test(r.indexname));
    expect(onCols({ rows: initial }, 'wardrobe_id', false)).toHaveLength(0);
    const cat = makeCatalog(initial);
    await migration.up(cat.queryInterface);
    expect(onCols(cat, 'wardrobe_id', false).map((r) => r.indexname)).toEqual(['episode_wardrobe_wardrobe_id']);

    await migration.down(cat.queryInterface);
    expect(cat.names()).toEqual(initial.map((r) => r.indexname).sort());
  });

  test('a fresh database with no episode_wardrobe is left alone', async () => {
    const cat = makeCatalog([], { tableExists: false });
    await migration.up(cat.queryInterface);
    await migration.down(cat.queryInterface);
    expect(cat.statements).toEqual([]);
  });

  test('parseIndexDef counts only plain btree indexes over bare columns', () => {
    expect(migration.parseIndexDef(def('a', 'episode_id'))).toEqual({ unique: false, columns: ['episode_id'] });
    expect(migration.parseIndexDef(def('a', 'episode_id, wardrobe_id', { unique: true }))).toEqual({ unique: true, columns: ['episode_id', 'wardrobe_id'] });
    expect(migration.parseIndexDef(def('a', 'episode_id', { where: ' WHERE (deleted_at IS NULL)' }))).toBeNull();
    expect(migration.parseIndexDef(def('a', 'episode_id DESC'))).toBeNull();
    expect(migration.parseIndexDef('CREATE INDEX a ON public.episode_wardrobe USING hash (episode_id)')).toBeNull();
    expect(migration.parseIndexDef(`${def('a', 'episode_id')} INCLUDE (wardrobe_id)`)).toBeNull();
  });

  test("the model's declared indexes are the ones the migration keeps", () => {
    let options;
    require('../../../src/models/EpisodeWardrobe')({ define: (name, attrs, opts) => { options = opts; return {}; } });
    expect(options.indexes.map((i) => [i.name, i.fields.join(','), !!i.unique])).toEqual([
      ['unique_episode_wardrobe', 'episode_id,wardrobe_id', true],
      ['episode_wardrobe_episode_id', 'episode_id', false],
      ['episode_wardrobe_wardrobe_id', 'wardrobe_id', false],
    ]);
  });
});
