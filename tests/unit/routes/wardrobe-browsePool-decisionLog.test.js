/**
 * #1954: POST /wardrobe/browse-pool (the route the styling game calls)
 * records who generated the pool in decision_log, and that write never
 * changes the pool response.
 *
 * The real handler runs against a fake sequelize that records the
 * decision_log INSERT (or throws on it). No database; the integration test
 * tests/integration/f-auth-1-g3-clause3.test.js reads the real table.
 */

const inserts = [];
let failInsert = null;

const fakeSequelize = {
  query: jest.fn(async (sql, opts = {}) => {
    if (/INSERT INTO decision_log/.test(sql)) {
      if (failInsert) throw failInsert;
      inserts.push(opts.replacements);
      return [[], 1];
    }
    return [[], 0];
  }),
};

let mockItems = [];
const mockModels = {
  sequelize: fakeSequelize,
  Sequelize: { Op: { or: Symbol('or') } },
  Wardrobe: { findAll: jest.fn(async () => mockItems.map((i) => ({ ...i }))) },
  WorldEvent: { findOne: jest.fn(async () => null) },
};

jest.mock('../../../src/models', () => mockModels);
jest.mock('../../../src/controllers/wardrobeController', () => new Proxy({}, { get: () => (req, res) => res.json({}) }));
jest.mock('../../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  authorize: () => (req, res, next) => next(),
}));

const router = require('../../../src/routes/wardrobe');

function browsePool() {
  const layer = router.stack.find((l) => l.route && l.route.path === '/browse-pool' && l.route.methods.post);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

async function run(body, user = { id: '33333333-3333-4333-8333-333333333333' }) {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await browsePool()({ body, params: {}, user }, res);
  return res;
}

const item = (over) => ({
  show_id: 'show-1', tier: 'mid', is_visible: true, is_owned: true, lock_type: 'none',
  coin_cost: 0, reputation_required: 0, outfit_match_weight: 5,
  aesthetic_tags: ['casual'], event_types: [], ...over,
});
const CLOSET = [
  item({ id: 'dress-1', name: 'Cotton Sundress', clothing_category: 'dress' }),
  item({ id: 'shoes-1', name: 'White Canvas Sneakers', clothing_category: 'shoes' }),
  item({ id: 'top-1', name: 'Linen Blouse', clothing_category: 'top' }),
];
const BODY = { show_id: 'show-1', episode_id: 'ep-1', prestige: 5, character_state: { coins: 100, reputation: 1 } };

let errSpy;
beforeEach(() => {
  inserts.length = 0;
  failInsert = null;
  mockItems = [];
  errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('POST /wardrobe/browse-pool writes decision_log (#1954)', () => {
  it('records the signed-in user, episode, show and pool facts', async () => {
    mockItems = CLOSET;
    const res = await run(BODY);
    expect(res.statusCode).toBe(200);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      type: 'browse_pool_generated',
      user_id: '33333333-3333-4333-8333-333333333333',
      episode_id: 'ep-1',
      show_id: 'show-1',
      source: 'styling_game',
    });
    expect(JSON.parse(inserts[0].decision_json)).toEqual({ bias: null, pool_size: res.body.pool.length, total_items: 3 });
    expect(JSON.parse(inserts[0].context_json)).toEqual({ has_wardrobe: true });
  });

  it('records an empty closet too, and its response is unchanged', async () => {
    const res = await run(BODY);
    expect(res.body).toEqual({ success: true, pool: [], message: 'No wardrobe items found. Seed items first.' });
    expect(inserts).toHaveLength(1);
    expect(JSON.parse(inserts[0].decision_json)).toEqual({ bias: null, pool_size: 0, total_items: 0 });
  });

  it('the response shape is the pool response, with no logging fields added', async () => {
    mockItems = CLOSET;
    const res = await run(BODY);
    expect(Object.keys(res.body).sort()).toEqual(['event_context', 'pool', 'pool_breakdown', 'scoring_summary', 'success']);
  });

  it('a failed INSERT still returns the pool (200), and is logged at error level', async () => {
    mockItems = CLOSET;
    failInsert = new Error('connection reset');
    const res = await run(BODY);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pool.map((i) => i.id).sort()).toEqual(['dress-1', 'shoes-1', 'top-1']);
    expect(inserts).toEqual([]);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringMatching(/decision_log write failed/),
      'browse_pool_generated',
      'connection reset'
    );
  });

  it('anything else thrown by the write is caught and logged; the pool still returns', async () => {
    mockItems = CLOSET;
    // requireAuth always sets req.user; this forces the route-level catch.
    const res = await run(BODY, null);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(inserts).toEqual([]);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[wardrobe\] browse-pool decision_log write failed/),
      expect.any(String)
    );
  });
});
