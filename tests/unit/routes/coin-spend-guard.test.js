/**
 * Coin spends never take character_state.coins below zero (Task #1933).
 *
 * Evoni's production read (ATTESTED, 2026-09-25): a character_state row
 * holds −100 coins. On main:
 *   - POST /wardrobe/select read the balance, then ran
 *     `SET coins = coins - :cost` with no condition, so a spend that landed
 *     between the read and the write took the balance below zero;
 *   - POST /wardrobe/purchase wrote back `read balance − cost`, so two
 *     purchases both paid from the same balance (a lost update);
 *   - POST /characters/:key/state/update wrote any coins value it was given,
 *     negative included.
 *
 * The handlers run against a small in-memory character_state (one row) and
 * financial ledger that interpret the handful of statements these routes
 * issue. A "concurrent spend" is modelled by the ORM read returning a stale
 * balance while the row already holds less. No database.
 */

const db = {
  row: { id: 'state-1', show_id: 'show-1', character_key: 'lala', coins: 0 },
  ledger: [],
  statements: [],
};

function num(v) { return Number(v); }

const fakeSequelize = {
  query: jest.fn(async (sql, opts = {}) => {
    const r = opts.replacements || {};
    db.statements.push({ sql, replacements: r });
    // The #1933 guard: conditional, atomic, returns the new balance.
    if (/UPDATE character_state[\s\S]*RETURNING coins/.test(sql)) {
      const delta = num(r.delta);
      if (r.stateId === db.row.id && (delta >= 0 || db.row.coins + delta >= 0)) {
        db.row.coins += delta;
        return [[{ coins: db.row.coins }], 1];
      }
      return [[], 0];
    }
    // main's /select: unconditional decrement.
    if (/UPDATE character_state SET coins = coins - :cost/.test(sql)) {
      if (r.id === db.row.id) db.row.coins -= num(r.cost);
      return [[], 1];
    }
    // main's /purchase: absolute write of the stale balance minus cost.
    if (/UPDATE character_state SET coins = :newCoins/.test(sql)) {
      db.row.coins = num(r.newCoins);
      return [[], 1];
    }
    // the manual edit: absolute write.
    if (/UPDATE character_state\s+SET coins = :coins/.test(sql)) {
      db.row.coins = num(r.coins);
      return [[], 1];
    }
    if (/SELECT coins FROM character_state WHERE id = :stateId/.test(sql)) {
      return [[{ coins: db.row.coins }], 1];
    }
    if (/INSERT INTO financial_transactions/.test(sql)) {
      db.ledger.push(r);
      return [[], 1];
    }
    if (/SELECT \* FROM wardrobe/.test(sql)) {
      return [[{ ...mockItem }], 1];
    }
    if (opts.type === 'SELECT') return [];
    return [[], 0];
  }),
  transaction: jest.fn(async (cb) => {
    const snapshot = { coins: db.row.coins, ledger: db.ledger.length };
    try {
      return await cb({ id: 'tx' });
    } catch (err) {
      db.row.coins = snapshot.coins;
      db.ledger.length = snapshot.ledger;
      throw err;
    }
  }),
  literal: (s) => s,
  QueryTypes: { SELECT: 'SELECT' },
};

let mockItem;
let mockStaleCoins;

const mockModels = {
  sequelize: fakeSequelize,
  Sequelize: { Op: { or: Symbol('or') } },
  Wardrobe: {
    findOne: jest.fn(async () => ({ ...mockItem })),
    update: jest.fn(async () => [1]),
  },
  CharacterState: {
    // The ORM read: what the handler believes the balance is.
    findOne: jest.fn(async () => ({ id: db.row.id, coins: mockStaleCoins })),
    findAll: jest.fn(async () => [{ ...db.row, coins: mockStaleCoins, reputation: 1, brand_trust: 1, influence: 1, stress: 0 }]),
    create: jest.fn(async () => ({})),
  },
};

jest.mock('../../../src/models', () => mockModels);
jest.mock('../../../src/controllers/wardrobeController', () => new Proxy({}, { get: () => (req, res) => res.json({}) }));
jest.mock('../../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  authorize: () => (req, res, next) => next(),
}));
jest.mock('../../../src/services/financialTransactionService', () => ({
  getCurrentBalance: jest.fn(async () => 350),
  seedStartingBalance: jest.fn(async () => null),
  logTransaction: jest.fn(async (sequelize, showId, tx) => {
    await sequelize.query('INSERT INTO financial_transactions (amount) VALUES (:amount)', {
      replacements: { amount: tx.amount, category: tx.category }, transaction: tx.transaction,
    });
    return { id: 'ftx', ...tx };
  }),
}));

const wardrobeRouter = require('../../../src/routes/wardrobe');
const evaluationRouter = require('../../../src/routes/evaluation');

function handler(router, path) {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods.post);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

async function run(router, path, body, params = {}) {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler(router, path)({ body, params, user: { id: 'u1' } }, res);
  return res;
}

const coinItem = { id: 'w-1', name: 'Sage Corset Lace-Up Halter Midi', is_owned: false, lock_type: 'coin', coin_cost: 300, reputation_required: 0 };

beforeEach(() => {
  db.row.coins = 0;
  db.ledger.length = 0;
  db.statements.length = 0;
  mockItem = { ...coinItem };
  mockModels.Wardrobe.update.mockClear();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const ownedWrites = () => mockModels.Wardrobe.update.mock.calls.filter(([vals]) => vals && vals.is_owned === true);

describe('POST /wardrobe/select auto-purchase (Task #1933)', () => {
  test('a spend that landed after the balance read is refused, not taken below zero', async () => {
    // The handler reads 350; a concurrent spend has already left 50.
    mockStaleCoins = 350;
    db.row.coins = 50;

    const res = await run(wardrobeRouter, '/select', { episode_id: 'ep-1', wardrobe_id: 'w-1', show_id: 'show-1' });

    // On main: 200, coins = 50 − 300 = −250.
    expect(db.row.coins).toBe(50);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INSUFFICIENT_COINS', needed: 300, have: 50 });
    expect(res.body.error).toBe('Not enough coins — need 300, have 50');
    expect(db.ledger).toEqual([]);
    expect(ownedWrites()).toEqual([]);
    expect(db.statements.some((s) => /INSERT INTO episode_wardrobe/.test(s.sql))).toBe(false);
  });

  test('a spend the balance covers deducts exactly the cost, conditionally, and logs one ledger row', async () => {
    mockStaleCoins = 350;
    db.row.coins = 350;

    const res = await run(wardrobeRouter, '/select', { episode_id: 'ep-1', wardrobe_id: 'w-1', show_id: 'show-1' });

    expect(res.statusCode).toBe(200);
    expect(res.body.coin_purchased).toBe(true);
    expect(db.row.coins).toBe(50);
    expect(db.ledger).toHaveLength(1);
    const update = db.statements.find((s) => /UPDATE character_state/.test(s.sql));
    expect(update.sql).toMatch(/coins \+ :delta >= 0/);
    expect(update.sql).toMatch(/RETURNING coins/);
  });

  test("Evoni's app test: 385 against 350 is refused before any write", async () => {
    mockStaleCoins = 350;
    db.row.coins = 350;
    mockItem = { ...coinItem, coin_cost: 385 };

    const res = await run(wardrobeRouter, '/select', { episode_id: 'ep-1', wardrobe_id: 'w-1', show_id: 'show-1' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Not enough coins — need 385, have 350');
    expect(db.row.coins).toBe(350);
    expect(db.statements.some((s) => /UPDATE character_state/.test(s.sql))).toBe(false);
  });
});

describe('POST /wardrobe/purchase (Task #1933)', () => {
  test('a purchase that lost a race is refused; the other spend is not overwritten', async () => {
    mockStaleCoins = 350;
    db.row.coins = 50;

    const res = await run(wardrobeRouter, '/purchase', { wardrobe_id: 'w-1', show_id: 'show-1' });

    // On main: 200 and coins = 350 − 300 = 50 written back — the item is
    // free and the concurrent spend is erased.
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INSUFFICIENT_COINS', needed: 300, have: 50 });
    expect(db.row.coins).toBe(50);
    expect(db.ledger).toEqual([]);
    expect(ownedWrites()).toEqual([]);
  });

  test('a covered purchase writes only the row it read and reports the balance the database returned', async () => {
    mockStaleCoins = 350;
    db.row.coins = 350;

    const res = await run(wardrobeRouter, '/purchase', { wardrobe_id: 'w-1', show_id: 'show-1' });

    expect(res.statusCode).toBe(200);
    expect(res.body.coins_after).toBe(50);
    expect(db.row.coins).toBe(50);
    const update = db.statements.find((s) => /UPDATE character_state/.test(s.sql));
    expect(update.sql).toMatch(/WHERE id = :stateId/);
    expect(update.sql).not.toMatch(/WHERE show_id/);
  });
});

describe('POST /characters/:key/state/update (Task #1933)', () => {
  test.each([[-100], ['-100'], [''], [null], ['abc'], [12.5]])('coins %p is refused and nothing is written', async (coins) => {
    mockStaleCoins = 350;
    db.row.coins = 350;

    const res = await run(evaluationRouter, '/characters/:key/state/update', { show_id: 'show-1', coins }, { key: 'lala' });

    // On main: −100 is written as −100.
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_COINS');
    expect(db.row.coins).toBe(350);
    expect(db.statements.some((s) => /UPDATE character_state/.test(s.sql))).toBe(false);
  });

  test('coins 0 is a valid balance', async () => {
    mockStaleCoins = 350;
    db.row.coins = 350;

    const res = await run(evaluationRouter, '/characters/:key/state/update', { show_id: 'show-1', coins: '0' }, { key: 'lala' });

    expect(res.statusCode).toBe(200);
    expect(db.row.coins).toBe(0);
  });
});
