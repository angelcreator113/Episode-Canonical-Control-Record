/**
 * The styling game asks whether Lala can wear an item now (Task #1937).
 *
 * 1. POST /wardrobe/browse-pool ranked by match score alone: its owned
 *    places went to the best-matching owned items of any category, and the
 *    required-slot top-up added the best-matching dresses and shoes whatever
 *    they cost. Seen on Deploy AH (ATTESTED, Evoni, 2026-09-26): Body offered
 *    only 385-coin dresses against 350 coins while the owned Cotton Sundress
 *    and White Canvas Sneakers sat in Full Closet. Now each required slot
 *    (body = a dress, or a top and a bottom; shoes) gets a reachable item
 *    when the show has one.
 * 2. The pool counted missing reputation as 1 (`|| 1`) where /select counts
 *    it as 0, so it offered reputation-1 items /select refused. Evoni's
 *    ruling (2026-09-26): /select's rule, 0 is 0.
 * 3. Lock called /select once per piece, each buying in its own
 *    transaction, so a later failure left earlier pieces bought and linked.
 *    POST /wardrobe/lock-outfit-atomic checks everything first and writes
 *    all of it in one transaction, or nothing.
 *
 * The handlers run against a small in-memory character_state row, ledger,
 * episode_wardrobe and ownership log that interpret the statements these
 * routes issue; the fake transaction restores them all on a throw, as a
 * rollback would. No database.
 */

const db = {
  row: { id: 'state-1', show_id: 'show-1', character_key: 'lala', coins: 0, reputation: 0 },
  ledger: [],
  links: [],
  ownedWrites: [],
  statements: [],
  failLinkOn: null,
};

let mockItems = [];
let mockStaleCoins = null;

const fakeSequelize = {
  query: jest.fn(async (sql, opts = {}) => {
    const r = opts.replacements || {};
    db.statements.push({ sql, replacements: r, transaction: opts.transaction || null });
    if (/UPDATE character_state[\s\S]*RETURNING coins/.test(sql)) {
      const delta = Number(r.delta);
      if (r.stateId === db.row.id && (delta >= 0 || db.row.coins + delta >= 0)) {
        db.row.coins += delta;
        return [[{ coins: db.row.coins }], 1];
      }
      return [[], 0];
    }
    if (/SELECT coins FROM character_state WHERE id = :stateId/.test(sql)) {
      return [[{ coins: db.row.coins }], 1];
    }
    if (/INSERT INTO financial_transactions/.test(sql)) {
      db.ledger.push(r);
      return [[], 1];
    }
    if (/INSERT INTO episode_wardrobe/.test(sql)) {
      if (db.failLinkOn && r.wardrobe_id === db.failLinkOn) throw new Error('connection reset');
      const m = sql.match(/'(approved)'/);
      db.links.push({ episode_id: r.episode_id, wardrobe_id: r.wardrobe_id, approval_status: m && m[1], sql });
      return [[], 1];
    }
    if (opts.type === 'SELECT') return [];
    return [[], 0];
  }),
  transaction: jest.fn(async (cb) => {
    const snap = { coins: db.row.coins, ledger: db.ledger.length, links: db.links.length, owned: db.ownedWrites.length };
    try {
      return await cb({ id: 'tx' });
    } catch (err) {
      db.row.coins = snap.coins;
      db.ledger.length = snap.ledger;
      db.links.length = snap.links;
      db.ownedWrites.length = snap.owned;
      throw err;
    }
  }),
  literal: (s) => s,
  QueryTypes: { SELECT: 'SELECT' },
};

const mockModels = {
  sequelize: fakeSequelize,
  Sequelize: { Op: { or: Symbol('or') } },
  Wardrobe: {
    findAll: jest.fn(async ({ where } = {}) => {
      const ids = where && Array.isArray(where.id) ? new Set(where.id) : null;
      return mockItems.filter((i) => !ids || ids.has(i.id)).map((i) => ({ ...i }));
    }),
    update: jest.fn(async (vals, opts = {}) => {
      if (vals && vals.is_owned === true) db.ownedWrites.push({ ids: opts.where.id, transaction: opts.transaction || null });
      return [1];
    }),
  },
  CharacterState: {
    findOne: jest.fn(async () => ({
      id: db.row.id,
      coins: mockStaleCoins ?? db.row.coins,
      reputation: db.row.reputation,
    })),
  },
  WorldEvent: { findOne: jest.fn(async () => null) },
};

jest.mock('../../../src/models', () => mockModels);
jest.mock('../../../src/controllers/wardrobeController', () => new Proxy({}, { get: () => (req, res) => res.json({}) }));
jest.mock('../../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  authorize: () => (req, res, next) => next(),
}));
jest.mock('../../../src/services/financialTransactionService', () => ({
  getCurrentBalance: jest.fn(async () => 500),
  logTransaction: jest.fn(async (sequelize, showId, tx) => {
    await sequelize.query('INSERT INTO financial_transactions (amount) VALUES (:amount)', {
      replacements: { amount: tx.amount, category: tx.category, source_id: tx.source_id, balance_before: tx.balance_before, balance_after: tx.balance_after },
      transaction: tx.transaction,
    });
    return { id: 'ftx', ...tx };
  }),
}));

const router = require('../../../src/routes/wardrobe');

function handler(path) {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods.post);
  if (!layer) throw new Error(`no POST ${path} route`);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

async function run(path, body) {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler(path)({ body, params: {}, user: { id: 'u1' } }, res);
  return res;
}

const item = (over) => ({
  show_id: 'show-1', tier: 'luxury', is_visible: true, is_owned: false, lock_type: 'none',
  coin_cost: 0, reputation_required: 0, outfit_match_weight: 5,
  aesthetic_tags: ['black', 'tie'], event_types: [], ...over,
});

// A black-tie gala. Lala has 350 coins. The best matches are owned
// accessories (they take the owned places) and dresses and shoes she can't
// afford; her owned body and shoes are casual and score low.
const OUT_OF_REACH = [
  item({ id: 'acc-1', name: 'Pearl Earrings', clothing_category: 'accessories', is_owned: true }),
  item({ id: 'acc-2', name: 'Silk Clutch', clothing_category: 'accessories', is_owned: true }),
  item({ id: 'd-1', name: 'Midnight Gown', clothing_category: 'dress', lock_type: 'coin', coin_cost: 385 }),
  item({ id: 'd-2', name: 'Onyx Column Dress', clothing_category: 'dress', lock_type: 'coin', coin_cost: 385 }),
  item({ id: 'd-3', name: 'Velvet Slip', clothing_category: 'dress', lock_type: 'coin', coin_cost: 385 }),
  item({ id: 'd-4', name: 'Satin Sheath', clothing_category: 'dress', lock_type: 'coin', coin_cost: 385 }),
  item({ id: 'd-5', name: 'Maison Exclusive', clothing_category: 'dress', lock_type: 'brand_exclusive' }),
  item({ id: 's-1', name: 'Crystal Heels', clothing_category: 'shoes', lock_type: 'coin', coin_cost: 400 }),
  item({ id: 's-2', name: 'Patent Pumps', clothing_category: 'shoes', lock_type: 'coin', coin_cost: 400 }),
  item({ id: 's-3', name: 'Satin Mules', clothing_category: 'shoes', lock_type: 'coin', coin_cost: 400 }),
];
const OWNED_SHOES = item({ id: 'own-shoes', name: 'White Canvas Sneakers', clothing_category: 'shoes', is_owned: true, tier: 'mid', aesthetic_tags: ['casual'] });
const OWNED_DRESS = item({ id: 'own-dress', name: 'Cotton Sundress', clothing_category: 'dress', is_owned: true, tier: 'mid', aesthetic_tags: ['casual'] });
const OWNED_TOP = item({ id: 'own-top', name: 'Linen Blouse', clothing_category: 'top', is_owned: true, tier: 'mid', aesthetic_tags: ['casual'] });
const OWNED_BOTTOM = item({ id: 'own-bottom', name: 'Wide-Leg Trousers', clothing_category: 'bottom', is_owned: true, tier: 'mid', aesthetic_tags: ['casual'] });

const POOL_BODY = {
  show_id: 'show-1', dress_code: 'black tie', event_type: 'gala', prestige: 8, strictness: 5,
  character_state: { coins: 350, reputation: 3 },
};

beforeEach(() => {
  db.row.coins = 0;
  db.row.reputation = 0;
  db.ledger.length = 0;
  db.links.length = 0;
  db.ownedWrites.length = 0;
  db.statements.length = 0;
  db.failLinkOn = null;
  mockStaleCoins = null;
  mockItems = [];
  mockModels.Wardrobe.update.mockClear();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const ids = (pool) => pool.map((i) => i.id);

describe('POST /wardrobe/browse-pool offers something wearable for each required slot (Task #1937)', () => {
  it('a closet whose best-matching body and shoes are out of reach still gets an owned dress and owned shoes', async () => {
    mockItems = [...OUT_OF_REACH, OWNED_DRESS, OWNED_SHOES];
    const res = await run('/browse-pool', POOL_BODY);
    expect(res.statusCode).toBe(200);
    const pool = res.body.pool;
    expect(ids(pool)).toEqual(expect.arrayContaining(['own-dress', 'own-shoes']));
    expect(pool.find((i) => i.id === 'own-dress')).toMatchObject({ can_select: true, pool_role: 'safe' });
    expect(pool.find((i) => i.id === 'own-shoes')).toMatchObject({ can_select: true, pool_role: 'safe' });
    // The ranking's own picks stay: stretch items and the locked tease.
    expect(pool.some((i) => i.pool_role === 'stretch')).toBe(true);
    expect(pool.some((i) => i.pool_role === 'locked_tease')).toBe(true);
    expect(ids(pool)).toEqual(expect.arrayContaining(['acc-1', 'acc-2', 'd-1']));
  });

  it('the top + bottom route: with no wearable dress, an owned top and bottom are offered', async () => {
    mockItems = [...OUT_OF_REACH, OWNED_TOP, OWNED_BOTTOM, OWNED_SHOES];
    const res = await run('/browse-pool', POOL_BODY);
    const pool = res.body.pool;
    expect(ids(pool)).toEqual(expect.arrayContaining(['own-top', 'own-bottom', 'own-shoes']));
    for (const id of ['own-top', 'own-bottom', 'own-shoes']) {
      expect(pool.find((i) => i.id === id).can_select).toBe(true);
    }
  });

  it('an affordable coin item counts as wearable', async () => {
    const affordable = item({ id: 'd-cheap', name: 'Budget Wrap Dress', clothing_category: 'dress', lock_type: 'coin', coin_cost: 200, tier: 'mid', aesthetic_tags: ['casual'] });
    mockItems = [...OUT_OF_REACH, affordable, OWNED_SHOES];
    const pool = (await run('/browse-pool', POOL_BODY)).body.pool;
    expect(pool.find((i) => i.id === 'd-cheap')).toMatchObject({ can_select: true, can_purchase: true });
  });

  it('adds nothing when no wearable item exists for a slot', async () => {
    mockItems = [...OUT_OF_REACH];
    const pool = (await run('/browse-pool', POOL_BODY)).body.pool;
    expect(pool.filter((i) => i.can_select && ['dress', 'top', 'bottom', 'shoes'].includes(i.clothing_category))).toEqual([]);
  });

  it('reputation 0 is 0, as in /select: a reputation-1 item is not reachable (Evoni, 2026-09-26)', async () => {
    mockItems = [
      item({ id: 'rep-dress', name: 'Invite-Only Gown', clothing_category: 'dress', lock_type: 'reputation', reputation_required: 1 }),
      OWNED_DRESS, OWNED_SHOES,
    ];
    for (const character_state of [{ coins: 350, reputation: 0 }, { coins: 350 }]) {
      const pool = (await run('/browse-pool', { ...POOL_BODY, character_state })).body.pool;
      const rep = pool.find((i) => i.id === 'rep-dress');
      expect(rep).toBeTruthy();
      expect(rep.can_select).toBe(false);
      expect(rep.risk_level).toBe('locked_tease');
    }
    const qualified = (await run('/browse-pool', { ...POOL_BODY, character_state: { coins: 350, reputation: 1 } })).body.pool;
    expect(qualified.find((i) => i.id === 'rep-dress').can_select).toBe(true);
  });
});

describe('POST /wardrobe/lock-outfit-atomic is all-or-nothing (Task #1937)', () => {
  const DRESS_300 = item({ id: 'buy-dress', name: 'Sage Corset Midi', clothing_category: 'dress', lock_type: 'coin', coin_cost: 300 });
  const SHOES_100 = item({ id: 'buy-shoes', name: 'Gold Strappy Heels', clothing_category: 'shoes', lock_type: 'coin', coin_cost: 100 });
  const BAG = item({ id: 'own-bag', name: 'Pearl Clutch', clothing_category: 'accessories', is_owned: true });
  const body = (wardrobe_ids) => ({ episode_id: 'ep-1', show_id: 'show-1', wardrobe_ids });
  const writes = () => db.statements.filter((s) => /INSERT|UPDATE/.test(s.sql));

  it('refuses when the second piece cannot be afforded: no coins spent, nothing written', async () => {
    db.row.coins = 350; // the dress (300) alone fits; dress + shoes (400) does not
    mockItems = [DRESS_300, SHOES_100, BAG];
    const res = await run('/lock-outfit-atomic', body(['buy-dress', 'buy-shoes', 'own-bag']));
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 'INSUFFICIENT_COINS', needed: 400, have: 350 });
    expect(db.row.coins).toBe(350);
    expect(writes()).toEqual([]);
    expect(db.links).toEqual([]);
    expect(db.ledger).toEqual([]);
    expect(mockModels.Wardrobe.update).not.toHaveBeenCalled();
  });

  it('a spend that lost a race after the up-front read rolls back every row', async () => {
    db.row.coins = 350;
    mockStaleCoins = 500; // the read saw 500; the row holds 350 when the spend runs
    mockItems = [DRESS_300, SHOES_100, BAG];
    const res = await run('/lock-outfit-atomic', body(['buy-dress', 'buy-shoes', 'own-bag']));
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_COINS');
    expect(db.row.coins).toBe(350);
    expect(db.links).toEqual([]);
    expect(db.ledger).toEqual([]);
    expect(db.ownedWrites).toEqual([]);
  });

  it('a link write that fails part-way rolls back the spend, the ledger and the earlier links', async () => {
    db.row.coins = 500;
    db.failLinkOn = 'buy-shoes';
    mockItems = [DRESS_300, SHOES_100, BAG];
    const res = await run('/lock-outfit-atomic', body(['buy-dress', 'buy-shoes', 'own-bag']));
    expect(res.statusCode).toBe(500);
    expect(db.row.coins).toBe(500);
    expect(db.links).toEqual([]);
    expect(db.ledger).toEqual([]);
    expect(db.ownedWrites).toEqual([]);
  });

  it('refuses a piece that is out of reach before writing anything', async () => {
    db.row.coins = 1000;
    mockItems = [DRESS_300, item({ id: 'excl', name: 'Maison Exclusive', clothing_category: 'shoes', lock_type: 'brand_exclusive' })];
    const res = await run('/lock-outfit-atomic', body(['buy-dress', 'excl']));
    expect(res.statusCode).toBe(400);
    expect(res.body.out_of_reach.map((i) => i.id)).toEqual(['excl']);
    expect(writes()).toEqual([]);
    expect(db.row.coins).toBe(1000);
  });

  it('a successful lock writes every link as approved and debits the total once', async () => {
    db.row.coins = 500;
    mockItems = [DRESS_300, SHOES_100, BAG];
    const res = await run('/lock-outfit-atomic', body(['buy-dress', 'buy-shoes', 'own-bag']));
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, coins_spent: 400, coins_after: 100 });
    expect(db.row.coins).toBe(100);

    const spends = db.statements.filter((s) => /UPDATE character_state/.test(s.sql));
    expect(spends).toHaveLength(1);
    expect(spends[0].replacements.delta).toBe(-400);
    expect(spends[0].transaction).toBeTruthy();

    expect(db.links.map((l) => l.wardrobe_id).sort()).toEqual(['buy-dress', 'buy-shoes', 'own-bag']);
    for (const l of db.links) {
      expect(l.approval_status).toBe('approved');
      expect(l.sql).toMatch(/ON CONFLICT \(episode_id, wardrobe_id\) DO UPDATE SET[\s\S]*deleted_at = NULL/);
    }
    expect(db.ledger.map((r) => [r.source_id, r.amount])).toEqual([['buy-dress', 300], ['buy-shoes', 100]]);
    expect(db.ledger.map((r) => [r.balance_before, r.balance_after])).toEqual([[500, 200], [200, 100]]);
    expect(db.ownedWrites).toEqual([{ ids: ['buy-dress', 'buy-shoes'], transaction: expect.anything() }]);
    expect(res.body.locked.filter((l) => l.coin_purchased).map((l) => l.id)).toEqual(['buy-dress', 'buy-shoes']);
  });

  it('an outfit of owned pieces spends nothing and writes no ledger rows', async () => {
    db.row.coins = 50;
    mockItems = [OWNED_DRESS, OWNED_SHOES];
    const res = await run('/lock-outfit-atomic', body(['own-dress', 'own-shoes']));
    expect(res.statusCode).toBe(200);
    expect(res.body.coins_spent).toBe(0);
    expect(db.row.coins).toBe(50);
    expect(db.statements.filter((s) => /UPDATE character_state/.test(s.sql))).toEqual([]);
    expect(db.ledger).toEqual([]);
    expect(db.links).toHaveLength(2);
  });

  it('a missing piece is a 404 and writes nothing', async () => {
    db.row.coins = 500;
    mockItems = [OWNED_DRESS];
    const res = await run('/lock-outfit-atomic', body(['own-dress', 'gone']));
    expect(res.statusCode).toBe(404);
    expect(res.body.missing).toEqual(['gone']);
    expect(writes()).toEqual([]);
  });
});
