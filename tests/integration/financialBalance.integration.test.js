jest.unmock('uuid');

/**
 * Integration Tests - the balance the affordability and financial-pressure
 * handlers use (F-Stats-1 Fix Plan v1.63 §66.3-F, Task #2078).
 *
 * GET /world/:showId/balance reads the ledger (financial_transactions) through
 * getCurrentBalance. These tests seed one show with a ledger that sums to 2000
 * and compare what each handler reports as the balance.
 *
 * Before the fix both handlers read character_state_history.state_json, a column
 * that does not exist, and answered 500 from a bare catch. They now read the
 * same ledger balance as /balance. financial-pressure's three other queries
 * stay as fallbacks and log when they fail.
 */
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');
const { DEFAULT_STARTING_BALANCE } = require('../../src/utils/financialRates');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

const LEDGER_BALANCE = 2000;

async function seedShow() {
  const ids = { show: uuid(), tx: uuid(), event: uuid() };
  await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, 'Balance Test Show', :slug, NOW(), NOW())`,
    { ...ids, slug: `balance-test-${ids.show.slice(0, 8)}` });
  await run(`INSERT INTO financial_transactions (id, show_id, type, category, amount, status) VALUES (:tx, :show, 'income', 'test', :amount, 'executed')`,
    { ...ids, amount: LEDGER_BALANCE });
  await run(`INSERT INTO world_events (id, show_id, name, prestige, cost_coins) VALUES (:event, :show, 'Balance Test Event', 5, 100)`, ids);
  return ids;
}

async function cleanup(ids) {
  await run(`DELETE FROM world_events WHERE id = :event`, ids);
  await run(`DELETE FROM financial_transactions WHERE id = :tx`, ids);
  await run(`DELETE FROM shows WHERE id = :show`, ids);
}

(shouldSkip ? describe.skip : describe)('affordability and financial-pressure balance (Task #2078)', () => {
  let token;
  let ids;
  const auth = () => `Bearer ${token}`;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-balance',
      email: 'test@balance.dev',
      name: 'Balance Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
    ids = await seedShow();
  });

  afterAll(async () => {
    if (ids) await cleanup(ids);
  });

  test('GET /balance reads the ledger', async () => {
    const res = await request(app).get(`/api/v1/world/${ids.show}/balance`).set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(LEDGER_BALANCE);
  });

  test('affordability uses the ledger balance, as /balance does', async () => {
    const res = await request(app)
      .get(`/api/v1/world/${ids.show}/events/${ids.event}/affordability`)
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.currentBalance).toBe(LEDGER_BALANCE);
  });

  test('financial-pressure uses the ledger balance, as /balance does', async () => {
    const res = await request(app).get(`/api/v1/world/${ids.show}/financial-pressure`).set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(LEDGER_BALANCE);
  });

  test('a failing fallback query in financial-pressure is logged, and the response still returns', async () => {
    const original = sequelize.query.bind(sequelize);
    const querySpy = jest.spyOn(sequelize, 'query').mockImplementation((sql, ...rest) => (
      typeof sql === 'string' && sql.includes('FROM opportunities')
        ? Promise.reject(new Error('test_2078: opportunities query refused'))
        : original(sql, ...rest)
    ));
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await request(app).get(`/api/v1/world/${ids.show}/financial-pressure`).set('Authorization', auth());
      expect(res.status).toBe(200);
      expect(res.body.balance).toBe(LEDGER_BALANCE);
      expect(res.body.pipeline_context).toBe('');
      expect(errors.mock.calls.some(([msg, detail]) =>
        String(msg).includes('opportunities query failed') && String(detail).includes('test_2078'))).toBe(true);
    } finally {
      querySpy.mockRestore();
      errors.mockRestore();
    }
  });

  test('when the ledger query fails, affordability takes getCurrentBalance\'s own fallback, not a fixed 500', async () => {
    const original = sequelize.query.bind(sequelize);
    const querySpy = jest.spyOn(sequelize, 'query').mockImplementation((sql, ...rest) => (
      typeof sql === 'string' && sql.includes('FROM financial_transactions')
        ? Promise.reject(new Error('test_2078: ledger query refused'))
        : original(sql, ...rest)
    ));
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await request(app)
        .get(`/api/v1/world/${ids.show}/events/${ids.event}/affordability`)
        .set('Authorization', auth());
      // getCurrentBalance catches a failed ledger query itself and falls back
      // to the show's starting balance; this show sets none, so the default.
      expect(res.status).toBe(200);
      expect(res.body.currentBalance).toBe(DEFAULT_STARTING_BALANCE);
    } finally {
      querySpy.mockRestore();
      errors.mockRestore();
    }
  });
});
