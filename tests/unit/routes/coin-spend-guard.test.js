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
 * issue. No database.
 *
 * D1 PR 3 (Task #2248; design §6.4): the wardrobe spends check the LEDGER
 * under the show lock (spendFromLedger), write the ledger row and sync the
 * cached coins from the ledger. A "concurrent spend" is modelled by the fast
 * balance read (getCurrentBalance) returning a stale ledger balance while the
 * ledger, read under the lock, already holds less. The manual edit's tests
 * still pin the cache; they change in D1 PR 4.
 */

const db = {
  row: { id: 'state-1', show_id: 'show-1', character_key: 'lala', coins: 0 },
  ledger: [],
  // The ledger sum, as spendFromLedger reads it under the show lock.
  ledgerBalance: 0,
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
    if (/SELECT id, show_id FROM episodes/.test(sql)) {
      if (r.episodeId === 'ep-1') return [{ id: 'ep-1', show_id: 'show-1' }];
      if (r.episodeId === 'ep-2') return [{ id: 'ep-2', show_id: 'show-2' }];
      return [];
    }
    if (opts.type === 'SELECT') return [];
    return [[], 0];
  }),
  transaction: jest.fn(async (cb) => {
    const snapshot = { coins: db.row.coins, ledger: db.ledger.length, ledgerBalance: db.ledgerBalance };
    try {
      return await cb({ id: 'tx' });
    } catch (err) {
      db.row.coins = snapshot.coins;
      db.ledger.length = snapshot.ledger;
      db.ledgerBalance = snapshot.ledgerBalance;
      throw err;
    }
  }),
  literal: (s) => s,
  QueryTypes: { SELECT: 'SELECT' },
};

let mockItem;
let mockStaleCoins;
let mockStaleLedger;

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
  // The fast read, outside the transaction: possibly stale.
  getCurrentBalance: jest.fn(async () => mockStaleLedger),
  seedStartingBalance: jest.fn(async () => null),
  logTransaction: jest.fn(async (sequelize, showId, tx) => {
    await sequelize.query('INSERT INTO financial_transactions (amount) VALUES (:amount)', {
      replacements: { amount: tx.amount, category: tx.category, episode_id: tx.episode_id, balance_before: tx.balance_before, balance_after: tx.balance_after },
      transaction: tx.transaction,
    });
    db.ledgerBalance -= Number(tx.amount);
    return { id: 'ftx', ...tx };
  }),
}));
// The ledger under the show lock: the check that decides, and the sync.
jest.mock('../../../src/services/coinLedgerSync', () => {
  const { InsufficientCoinsError } = jest.requireActual('../../../src/services/coinBalanceGuard');
  return {
    spendFromLedger: jest.fn(async (sequelize, { cost, transaction, action }) => {
      if (!transaction) throw new TypeError('spendFromLedger: a transaction is required');
      if (db.ledgerBalance - cost < 0) throw new InsufficientCoinsError({ needed: cost, have: db.ledgerBalance, action });
      return { balance: db.ledgerBalance, cost };
    }),
    syncCoinsFromLedger: jest.fn(async (sequelize, showId, { transaction } = {}) => {
      if (!transaction) throw new TypeError('syncCoinsFromLedger: a transaction is required');
      db.row.coins = db.ledgerBalance;
      return { balance: db.ledgerBalance, rows_updated: 1 };
    }),
  };
});

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
  db.ledgerBalance = 0;
  db.statements.length = 0;
  mockItem = { ...coinItem };
  mockModels.Wardrobe.update.mockClear();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const ownedWrites = () => mockModels.Wardrobe.update.mock.calls.filter(([vals]) => vals && vals.is_owned === true);

describe('POST /wardrobe/select auto-purchase (Tasks #1933, #2248)', () => {
  test('a spend that landed after the balance read is refused under the lock, and nothing is written', async () => {
    // The fast read says 350; a concurrent spend has already left 50.
    mockStaleLedger = 350;
    db.ledgerBalance = 50;
    db.row.coins = 50;

    const res = await run(wardrobeRouter, '/select', { episode_id: 'ep-1', wardrobe_id: 'w-1', show_id: 'show-1' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INSUFFICIENT_COINS', needed: 300, have: 50 });
    expect(res.body.error).toBe('Not enough coins — need 300, have 50');
    expect(db.ledgerBalance).toBe(50);
    expect(db.row.coins).toBe(50);
    expect(db.ledger).toEqual([]);
    expect(ownedWrites()).toEqual([]);
    expect(db.statements.some((s) => /INSERT INTO episode_wardrobe/.test(s.sql))).toBe(false);
  });

  test('a covered spend books one ledger row on the episode and syncs coins from the ledger', async () => {
    mockStaleLedger = 350;
    db.ledgerBalance = 350;
    db.row.coins = 560; // a stale cache: the ledger decides

    const res = await run(wardrobeRouter, '/select', { episode_id: 'ep-1', wardrobe_id: 'w-1', show_id: 'show-1' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ coin_purchased: true, coins_after: 50 });
    expect(db.ledgerBalance).toBe(50);
    expect(db.row.coins).toBe(50);
    expect(db.ledger).toEqual([expect.objectContaining({ amount: 300, episode_id: 'ep-1', balance_before: 350, balance_after: 50 })]);
    // Nothing writes the cache but the sync.
    expect(db.statements.some((s) => /UPDATE character_state/.test(s.sql))).toBe(false);
  });

  test("Evoni's app test: 385 against 350 is refused before any write", async () => {
    mockStaleLedger = 350;
    db.ledgerBalance = 350;
    db.row.coins = 350;
    mockItem = { ...coinItem, coin_cost: 385 };

    const res = await run(wardrobeRouter, '/select', { episode_id: 'ep-1', wardrobe_id: 'w-1', show_id: 'show-1' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Not enough coins — need 385, have 350');
    expect(db.row.coins).toBe(350);
    expect(db.ledger).toEqual([]);
  });

  test.each([
    ['another show', 'ep-2', 400],
    ['no live episode', 'ep-gone', 404],
  ])('an episode of %s is refused before any write (§8(aa) M3)', async (_label, episodeId, status) => {
    mockStaleLedger = 350;
    db.ledgerBalance = 350;

    const res = await run(wardrobeRouter, '/select', { episode_id: episodeId, wardrobe_id: 'w-1', show_id: 'show-1' });

    expect(res.statusCode).toBe(status);
    expect(db.ledger).toEqual([]);
    expect(db.ledgerBalance).toBe(350);
    expect(ownedWrites()).toEqual([]);
  });
});

describe('POST /wardrobe/purchase (Tasks #1933, #2248)', () => {
  test('a purchase that lost a race is refused under the lock; the other spend stands', async () => {
    mockStaleLedger = 350;
    db.ledgerBalance = 50;
    db.row.coins = 50;

    const res = await run(wardrobeRouter, '/purchase', { wardrobe_id: 'w-1', show_id: 'show-1' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INSUFFICIENT_COINS', needed: 300, have: 50 });
    expect(db.ledgerBalance).toBe(50);
    expect(db.row.coins).toBe(50);
    expect(db.ledger).toEqual([]);
    expect(ownedWrites()).toEqual([]);
  });

  test('a covered purchase books the ledger row and reports the ledger before and after', async () => {
    mockStaleLedger = 350;
    db.ledgerBalance = 350;
    db.row.coins = 560;

    const res = await run(wardrobeRouter, '/purchase', { wardrobe_id: 'w-1', show_id: 'show-1' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ coins_before: 350, coins_after: 50 });
    expect(db.row.coins).toBe(50);
    expect(db.ledger).toEqual([expect.objectContaining({ amount: 300, episode_id: null })]);
    expect(db.statements.some((s) => /UPDATE character_state/.test(s.sql))).toBe(false);
  });

  test('a purchase in an episode records the episode on its ledger row (§8(aa) M3)', async () => {
    mockStaleLedger = 350;
    db.ledgerBalance = 350;

    const res = await run(wardrobeRouter, '/purchase', { wardrobe_id: 'w-1', show_id: 'show-1', episode_id: 'ep-1' });

    expect(res.statusCode).toBe(200);
    expect(db.ledger).toEqual([expect.objectContaining({ episode_id: 'ep-1' })]);
  });

  test('the fast refusal reads the ledger, not the cache', async () => {
    mockStaleLedger = 100;
    db.ledgerBalance = 100;
    db.row.coins = 560;

    const res = await run(wardrobeRouter, '/purchase', { wardrobe_id: 'w-1', show_id: 'show-1' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: 'Not enough coins', current: 100, needed: 300, deficit: 200 });
    expect(db.ledger).toEqual([]);
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
