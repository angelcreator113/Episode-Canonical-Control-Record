/**
 * POST /wardrobe/select — the styling game's pick is the episode's approved
 * look (Task #1924).
 *
 * The raw INSERT named only id, episode_id, wardrobe_id, created_at and
 * updated_at, so its rows had no approval state and an
 * `approval_status = 'approved'` filter would not count them once the
 * column existed. Evoni's ruling (2026-09-25): the game's picks are
 * deliberate choices, 'approved'. Picking a removed (soft-deleted) pair
 * again brings it back.
 *
 * The real handler runs with sequelize.query recording the SQL; each
 * statement's episode_wardrobe columns are checked against the table after
 * the live migrations (tests/unit/helpers/episodeWardrobeTable.js). No
 * database.
 */
const { postMigrationColumns } = require('../helpers/episodeWardrobeTable');

const captured = [];
const mockModels = {
  sequelize: {
    query: jest.fn(async (sql, opts = {}) => { captured.push({ sql, opts }); return [[], 0]; }),
  },
  Wardrobe: {
    findOne: jest.fn(async () => ({ id: 'w-1', name: 'Gold gown', is_owned: true, lock_type: null })),
    update: jest.fn(async () => [1]),
  },
};
jest.mock('../../../src/models', () => mockModels);
jest.mock('../../../src/controllers/wardrobeController', () => new Proxy({}, { get: () => (req, res) => res.json({}) }));
jest.mock('../../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  authorize: () => (req, res, next) => next(),
}));

const router = require('../../../src/routes/wardrobe');

function selectHandler() {
  const layer = router.stack.find((l) => l.route && l.route.path === '/select' && l.route.methods.post);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

async function runSelect(body) {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await selectHandler()({ body, user: { id: 'u1' } }, res);
  return res;
}

/** INSERT column list mapped to its VALUES, for a single-row INSERT. */
function insertValues(sql) {
  const m = sql.match(/INSERT INTO episode_wardrobe\s*\(([^)]*)\)\s*VALUES\s*\(([\s\S]*?)\)\s*ON CONFLICT/);
  if (!m) return null;
  const cols = m[1].split(',').map((s) => s.trim());
  const vals = m[2].split(/,(?![^(]*\))/).map((s) => s.trim());
  return Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
}

describe('POST /wardrobe/select sets approval (Task #1924)', () => {
  beforeEach(() => {
    captured.length = 0;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('the INSERT writes the pick as approved, naming only columns the table has', async () => {
    const res = await runSelect({ episode_id: 'ep-1', wardrobe_id: 'w-1' });
    expect(res.statusCode).toBe(200);

    const insert = captured.find((q) => /INSERT INTO episode_wardrobe/.test(q.sql));
    const values = insertValues(insert.sql);
    // On main: no approval_status in the column list.
    expect(values.approval_status).toBe("'approved'");
    expect(values.approved_at).toBe('NOW()');

    const cols = await postMigrationColumns();
    expect(Object.keys(values).filter((c) => !cols.has(c))).toEqual([]);
  });

  test('picking a pair that already has a link approves it and brings a removed one back', async () => {
    await runSelect({ episode_id: 'ep-1', wardrobe_id: 'w-1' });
    const insert = captured.find((q) => /INSERT INTO episode_wardrobe/.test(q.sql));
    const onConflict = insert.sql.slice(insert.sql.indexOf('ON CONFLICT'));
    expect(onConflict).toMatch(/approval_status = 'approved'/);
    expect(onConflict).toMatch(/deleted_at = NULL/);

    const cols = await postMigrationColumns();
    const set = [...onConflict.matchAll(/(\w+) = /g)].map((m) => m[1]);
    expect(set.filter((c) => !cols.has(c))).toEqual([]);
  });
});
