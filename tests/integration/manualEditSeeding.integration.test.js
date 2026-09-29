/**
 * D1 PR 4: the manual edit, the admin reset and the seed paths
 * (docs/COINS_LEDGER_CACHE_DESIGN.md §6.5, §6.6; §8(y) Q1, Q3, Q5;
 * Task #2249).
 *
 * - A Lala coin edit books a manual_adjustment for the difference from the
 *   ledger, computed under the show lock, and syncs; coins are never SET.
 * - Coins are Lala's only (Q3): a coin change on another key is refused; its
 *   other stats stay editable.
 * - Admin reset leaves coins alone (Q5).
 * - A new 'lala' row starts at the ledger balance (Q1: the show's
 *   starting_balance, default 1900), never at 500, from GET /characters/lala/
 *   state and from completeEpisode's auto-seed. A show that does not exist
 *   gets no row.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { getCurrentBalance } = require('../../src/services/financialTransactionService');
const { completeEpisode } = require('../../src/services/episodeCompletionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('manual edit, admin reset and seeding go through the ledger (D1 PR 4)', () => {
  const shows = [];
  const tokenFor = (groups) => TokenService.generateTokenPair({
    id: `test-user-pr4-${groups[0]}`, email: 'test@pr4.dev', name: 'PR4 Test', groups, role: groups[0],
  }).accessToken;
  const editor = () => tokenFor(['USER', 'EDITOR']);
  const admin = () => tokenFor(['ADMIN']);

  // A show whose ledger starts at `start`; with `lalaCoins` set, a 'lala'
  // row holding that (stale) cache value.
  async function seed({ start = 1000, lalaCoins = 5000, otherKey = null } = {}) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST(:meta AS jsonb), NOW(), NOW())`,
      { show, name: `PR4 ${show.slice(0, 8)}`, slug: `pr4-${show.slice(0, 8)}`, meta: JSON.stringify({ starting_balance: start }) });
    if (lalaCoins !== null) {
      await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
                 VALUES (:id, :show, 'lala', :coins, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show, coins: lalaCoins });
    }
    if (otherKey) {
      await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
                 VALUES (:id, :show, :key, 500, 1, 1, 1, 0, NOW(), NOW())`, { id: uuid(), show, key: otherKey });
    }
    return show;
  }

  const stateOf = async (show, key = 'lala') => (await q(
    `SELECT coins, reputation, brand_trust, influence, stress FROM character_state WHERE show_id = :show AND character_key = :key`,
    { show, key }))[0];
  const rowsOf = (show, category) => q(
    `SELECT type, amount::float AS amount FROM financial_transactions WHERE show_id = :show AND category = :category AND deleted_at IS NULL`,
    { show, category });
  const update = (show, key, body, token = editor()) => request(app)
    .post(`/api/v1/characters/${key}/state/update`).set('Authorization', `Bearer ${token}`).send({ show_id: show, ...body });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200)); // feed posts run after commit
    for (const show of shows) {
      await run(`DELETE FROM feed_posts WHERE show_id = :show`, { show });
      await run(`DELETE FROM financial_transactions WHERE show_id = :show`, { show });
      await run(`DELETE FROM character_state_history WHERE show_id = :show`, { show });
      await run(`DELETE FROM character_state WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  describe('POST /characters/lala/state/update', () => {
    it('books a manual_adjustment for the difference from the ledger, not the stale cache, and syncs', async () => {
      const show = await seed({ start: 1000, lalaCoins: 5000 });

      const res = await update(show, 'lala', { coins: 1200, reputation: 4 });

      expect(res.status).toBe(200);
      expect(res.body.state).toMatchObject({ coins: 1200, reputation: 4 });
      expect(res.body.previous_state.coins).toBe(1000);
      expect(res.body.deltas).toMatchObject({ coins: 200, reputation: 1 });
      expect(await rowsOf(show, 'manual_adjustment')).toEqual([{ type: 'income', amount: 200 }]);
      expect(await getCurrentBalance(sequelize, show)).toBe(1200);
      expect(await stateOf(show)).toMatchObject({ coins: 1200, reputation: 4 });
      const [history] = await q(`SELECT deltas_json, state_after_json FROM character_state_history WHERE show_id = :show`, { show });
      const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
      expect(asJson(history.deltas_json)).toMatchObject({ coins: 200 });
      expect(asJson(history.state_after_json)).toMatchObject({ coins: 1200 });
    });

    it('an edit to the ledger balance books nothing; the other stats are still saved', async () => {
      const show = await seed({ start: 1000, lalaCoins: 5000 });

      const res = await update(show, 'lala', { coins: 1000, stress: 6 });

      expect(res.status).toBe(200);
      expect(await rowsOf(show, 'manual_adjustment')).toEqual([]);
      expect(await stateOf(show)).toMatchObject({ coins: 1000, stress: 6 });
    });

    it('a reduction books an expense adjustment', async () => {
      const show = await seed({ start: 1000 });

      await update(show, 'lala', { coins: 250 });

      expect(await rowsOf(show, 'manual_adjustment')).toEqual([{ type: 'expense', amount: 750 }]);
      expect(await stateOf(show)).toMatchObject({ coins: 250 });
    });
  });

  describe('coins are Lala\'s only (Q3)', () => {
    it('a coin change on another key is refused and books nothing', async () => {
      const show = await seed({ otherKey: 'justawoman' });

      const res = await update(show, 'justawoman', { coins: 900 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('COINS_LALA_ONLY');
      expect(await rowsOf(show, 'manual_adjustment')).toEqual([]);
      expect(await stateOf(show, 'justawoman')).toMatchObject({ coins: 500 });
    });

    it("another key's other stats stay editable, with its unchanged coins in the form", async () => {
      const show = await seed({ otherKey: 'justawoman' });

      const res = await update(show, 'justawoman', { coins: 500, reputation: 5 });

      expect(res.status).toBe(200);
      expect(await stateOf(show, 'justawoman')).toMatchObject({ coins: 500, reputation: 5 });
      expect(await rowsOf(show, 'manual_adjustment')).toEqual([]);
    });
  });

  describe('POST /admin/reset-character-stats (Q5)', () => {
    it('resets the story stats and leaves coins alone', async () => {
      const show = await seed({ start: 1000, lalaCoins: 1000 });

      const res = await request(app).post('/api/v1/admin/reset-character-stats')
        .set('Authorization', `Bearer ${admin()}`).send({ showId: show });

      expect(res.status).toBe(200);
      expect(res.body.coins_unchanged).toBe(true);
      expect(await stateOf(show)).toMatchObject({ coins: 1000, reputation: 0, brand_trust: 0, influence: 0, stress: 0 });
    });
  });

  describe('seeding a new lala row (Q1)', () => {
    it('GET /characters/lala/state creates the row at the ledger balance, seeding the ledger', async () => {
      const show = await seed({ start: 1200, lalaCoins: null });

      const res = await request(app).get(`/api/v1/characters/lala/state?show_id=${show}`)
        .set('Authorization', `Bearer ${editor()}`);

      expect(res.status).toBe(200);
      expect(res.body.state.coins).toBe(1200);
      expect(await stateOf(show)).toMatchObject({ coins: 1200 });
      expect(await rowsOf(show, 'seed')).toEqual([{ type: 'income', amount: 1200 }]);
    });

    it('the default starting balance is 1900, not 500', async () => {
      const show = uuid();
      shows.push(show);
      await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, 'PR4 default', :slug, NOW(), NOW())`,
        { show, slug: `pr4d-${show.slice(0, 8)}` });

      await request(app).get(`/api/v1/characters/lala/state?show_id=${show}`).set('Authorization', `Bearer ${editor()}`);

      expect(await stateOf(show)).toMatchObject({ coins: 1900 });
    });

    it('a show that does not exist gets no row', async () => {
      const ghost = uuid();

      const res = await request(app).get(`/api/v1/characters/lala/state?show_id=${ghost}`)
        .set('Authorization', `Bearer ${editor()}`);

      expect(res.status).toBe(404);
      expect(await q(`SELECT id FROM character_state WHERE show_id = :ghost`, { ghost })).toEqual([]);
    });

    it("completeEpisode's auto-seed starts the row at the ledger balance, even when the completion is then refused", async () => {
      // The auto-seed commits before D2's transaction. A completion refused
      // for taking Lala below zero (Q6) rolls back, but the seeded row stays:
      // it must hold the ledger balance, not 500.
      const show = await seed({ start: 50, lalaCoins: null });
      const ep = uuid();
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
                 VALUES (:ep, :show, 'Seed episode', 1, 'draft', NOW(), NOW())`, { ep, show });
      await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, is_paid, payment_amount,
                   prestige, created_at, updated_at)
                 VALUES (:id, :show, 'Seed Gala', 'used', :ep, 100, false, 0, 5, NOW(), NOW())`, { id: uuid(), show, ep });

      await expect(completeEpisode(ep, show, sequelize)).rejects.toMatchObject({ code: 'INSUFFICIENT_COINS' });

      const rows = await q(`SELECT coins FROM character_state WHERE show_id = :show AND character_key = 'lala'`, { show });
      expect(rows).toHaveLength(1);
      expect(rows[0].coins).toBe(50);
      expect(await getCurrentBalance(sequelize, show)).toBe(50);
    });
  });
});
