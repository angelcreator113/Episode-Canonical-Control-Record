jest.unmock('uuid');

/**
 * Integration Tests - the balance the affordability and financial-pressure
 * handlers use (F-Stats-1 Fix Plan v1.63 §66.3-F, Task #2078).
 *
 * GET /world/:showId/balance reads the ledger (financial_transactions) through
 * getCurrentBalance. These tests seed one show with a ledger that sums to 2000
 * and compare what each handler reports as the balance.
 */
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

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

  test('today, affordability uses a balance of 500, not the ledger', async () => {
    const res = await request(app)
      .get(`/api/v1/world/${ids.show}/events/${ids.event}/affordability`)
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.currentBalance).toBe(500);
  });

  test('today, financial-pressure uses a balance of 500, not the ledger', async () => {
    const res = await request(app).get(`/api/v1/world/${ids.show}/financial-pressure`).set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(500);
  });
});
