/**
 * POST /shows/:id/seed-balance (Evoni, 2026-10-07: Money "fix the broken
 * bits"). It answered success after a failed seed, deleted the seed when the
 * starting balance was 0, and left Lala's stored coins on the old number.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

(shouldSkip ? describe.skip : describe)('Seed the starting balance', () => {
  const shows = [];
  let token;

  beforeAll(() => {
    token = TokenService.generateTokenPair({ id: 'test-seed', email: 's@seed.dev', name: 'Seed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
  });
  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM financial_transactions WHERE show_id = :show`, { show });
      await run(`DELETE FROM character_state WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  async function seedShow(startingBalance) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :n, :n, :meta, NOW(), NOW())`,
      { show, n: `seed-${show.slice(0, 8)}`, meta: JSON.stringify({ starting_balance: startingBalance }) });
    await models.CharacterState.create({ show_id: show, character_key: 'lala', coins: 7, reputation: 1 });
    return show;
  }
  const post = (show, body) => request(app).post(`/api/v1/shows/${show}/seed-balance`).set('Authorization', `Bearer ${token}`).send(body);
  const seeds = (show) => q(`SELECT amount FROM financial_transactions WHERE show_id = :show AND category = 'seed' AND deleted_at IS NULL`, { show });
  const coins = async (show) => Number((await q(`SELECT coins FROM character_state WHERE show_id = :show AND character_key = 'lala'`, { show }))[0].coins);

  it("seeding writes the seed and Lala's stored coins follow the ledger", async () => {
    const show = await seedShow(500);
    const res = await post(show, {});
    expect(res.status).toBe(200);
    expect(res.body.seeded).toBe(true);
    expect((await seeds(show)).map((r) => Number(r.amount))).toEqual([500]);
    expect(await coins(show)).toBe(500);
  });

  it('force with a starting balance of 0 is refused and the seed stays', async () => {
    const show = await seedShow(500);
    await post(show, {});
    await run(`UPDATE shows SET metadata = :meta WHERE id = :show`, { show, meta: JSON.stringify({ starting_balance: 0 }) });
    const res = await post(show, { force: true });
    expect(res.status).toBe(400);
    expect((await seeds(show)).map((r) => Number(r.amount))).toEqual([500]);
  });

  it('force replaces the seed with the new starting balance, once', async () => {
    const show = await seedShow(500);
    await post(show, {});
    await run(`UPDATE shows SET metadata = :meta WHERE id = :show`, { show, meta: JSON.stringify({ starting_balance: 800 }) });
    const res = await post(show, { force: true });
    expect(res.status).toBe(200);
    expect((await seeds(show)).map((r) => Number(r.amount))).toEqual([800]);
    expect(await coins(show)).toBe(800);
  });
});
