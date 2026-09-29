/**
 * D1 PR 3: the wardrobe spends go through the ledger (docs/EVENT_EPISODE_FLOW.md
 * §8(x) D1, §8(y); docs/COINS_LEDGER_CACHE_DESIGN.md §6.4; Task #2248).
 *
 * - /select, /lock-outfit-atomic and /purchase check the ledger under the
 *   show lock, book their rows and sync character_state.coins from the
 *   ledger; coins_after is the ledger balance. The cache starts stale here
 *   (5000), so a spend that read it would show.
 * - §8(aa) M3: a spend in an episode's context records the episode's id.
 * - §8(z) Law 4, "Purchased things cost money once": finalize does not charge
 *   again for a piece the ledger shows as bought, whichever spend bought it.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { finalizeEpisodeFinancials, getCurrentBalance } = require('../../src/services/financialTransactionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('wardrobe spends go through the ledger (D1 PR 3)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-wardrobe-ledger', email: 'test@wardrobe-ledger.dev', name: 'Wardrobe Ledger Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  // A show whose ledger will start at `start` coins (its seed), with a stale
  // cache of 5000. An unpaid event (entry 100) on the episode wears two
  // unowned coin pieces: the gown (200) and the clutch (50).
  async function seed({ start = 1000 } = {}) {
    const ids = { show: uuid(), ep: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST(:meta AS jsonb), NOW(), NOW())`,
      { ...ids, name: `Ledger spends ${ids.show.slice(0, 8)}`, slug: `wls-${ids.show.slice(0, 8)}`, meta: JSON.stringify({ starting_balance: start }) });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Ledger episode', 1, 'draft', NOW(), NOW())`, ids);
    const gown = await models.Wardrobe.create({ name: 'Gold Gown', clothing_category: 'dress', show_id: ids.show, lock_type: 'coin', coin_cost: 200, is_owned: false });
    const clutch = await models.Wardrobe.create({ name: 'Pearl Clutch', clothing_category: 'accessories', show_id: ids.show, lock_type: 'coin', coin_cost: 50, is_owned: false });
    ids.gown = gown.id;
    ids.clutch = clutch.id;
    await models.CharacterState.create({ show_id: ids.show, character_key: 'lala', coins: 5000, reputation: 5 });
    const outfit = [
      { id: ids.gown, name: 'Gold Gown', coin_cost: 200, is_owned: false },
      { id: ids.clutch, name: 'Pearl Clutch', coin_cost: 50, is_owned: false },
    ];
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, is_paid, payment_amount,
                 prestige, outfit_pieces, created_at, updated_at)
               VALUES (:event, :show, 'Ledger Gala', 'used', :ep, 100, false, 0, 2, CAST(:outfit AS jsonb), NOW(), NOW())`,
      { ...ids, outfit: JSON.stringify(outfit) });
    return ids;
  }

  const post = (path, body) => request(app).post(`/api/v1/wardrobe${path}`).set('Authorization', `Bearer ${token}`).send(body);
  const cache = async (ids) => (await q(`SELECT coins FROM character_state WHERE show_id = :show AND character_key = 'lala'`, ids))[0].coins;
  const ledgerOf = (ids) => getCurrentBalance(sequelize, ids.show);
  const purchaseRows = (ids) => q(
    `SELECT source_id, amount::float AS amount, episode_id, metadata->>'flow' AS flow
       FROM financial_transactions WHERE show_id = :show AND category = 'wardrobe_purchase' AND deleted_at IS NULL
      ORDER BY created_at`, ids);

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM financial_transactions WHERE show_id = :show`, { show });
      await run(`DELETE FROM episode_wardrobe WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show });
      await run(`DELETE FROM character_state_history WHERE show_id = :show`, { show }).catch((err) => console.warn('cleanup history:', err.message));
      await run(`DELETE FROM character_state WHERE show_id = :show`, { show });
      await run(`DELETE FROM wardrobe WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  describe('each spend: coins = ledger, coins_after = ledger, the row on the episode (M3)', () => {
    it('/select', async () => {
      const ids = await seed();
      const res = await post('/select', { episode_id: ids.ep, wardrobe_id: ids.gown, show_id: ids.show });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ coin_purchased: true, coins_after: 800 });
      expect(await ledgerOf(ids)).toBe(800);
      expect(await cache(ids)).toBe(800);
      expect(await purchaseRows(ids)).toEqual([{ source_id: ids.gown, amount: 200, episode_id: ids.ep, flow: 'select' }]);
    });

    it('/lock-outfit-atomic', async () => {
      const ids = await seed();
      const res = await post('/lock-outfit-atomic', { episode_id: ids.ep, show_id: ids.show, wardrobe_ids: [ids.gown, ids.clutch] });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ coins_spent: 250, coins_after: 750 });
      expect(await ledgerOf(ids)).toBe(750);
      expect(await cache(ids)).toBe(750);
      expect((await purchaseRows(ids)).map((r) => [r.amount, r.episode_id, r.flow])).toEqual([
        [200, ids.ep, 'lock_outfit'], [50, ids.ep, 'lock_outfit'],
      ]);
    });

    it('/purchase, in an episode and outside one', async () => {
      const ids = await seed();
      const inEpisode = await post('/purchase', { wardrobe_id: ids.gown, show_id: ids.show, episode_id: ids.ep });
      expect(inEpisode.status).toBe(200);
      expect(inEpisode.body).toMatchObject({ coins_before: 1000, coins_after: 800 });

      const outside = await post('/purchase', { wardrobe_id: ids.clutch, show_id: ids.show });
      expect(outside.status).toBe(200);
      expect(outside.body).toMatchObject({ coins_before: 800, coins_after: 750 });

      expect(await cache(ids)).toBe(750);
      expect((await purchaseRows(ids)).map((r) => [r.source_id, r.episode_id, r.flow])).toEqual([
        [ids.gown, ids.ep, 'purchase'], [ids.clutch, null, 'purchase'],
      ]);
    });
  });

  it('a spend the ledger cannot cover is refused, whatever the cache says, and writes nothing', async () => {
    const ids = await seed({ start: 100 }); // cache 5000, ledger 100
    const res = await post('/purchase', { wardrobe_id: ids.gown, show_id: ids.show });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ current: 100, needed: 200 });
    expect(await purchaseRows(ids)).toEqual([]);
    const owned = await q('SELECT is_owned FROM wardrobe WHERE id = :gown', ids);
    expect(owned[0].is_owned).toBe(false);
  });

  it('two concurrent purchases that together exceed the ledger: exactly one succeeds', async () => {
    const ids = await seed({ start: 300 });
    const [a, b] = await Promise.all([
      post('/purchase', { wardrobe_id: ids.gown, show_id: ids.show }),
      post('/lock-outfit-atomic', { episode_id: ids.ep, show_id: ids.show, wardrobe_ids: [ids.gown] }),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 400]);
    expect(await purchaseRows(ids)).toHaveLength(1);
    expect(await ledgerOf(ids)).toBe(100);
    expect(await cache(ids)).toBe(100);
  });

  it('an episode of another show is refused before any write (M3)', async () => {
    const ids = await seed();
    const other = await seed();
    const res = await post('/purchase', { wardrobe_id: ids.gown, show_id: ids.show, episode_id: other.ep });

    expect(res.status).toBe(400);
    expect(await purchaseRows(ids)).toEqual([]);
    expect(await ledgerOf(ids)).toBe(1000);
  });

  describe('Law 4: purchased things cost money once', () => {
    it('a piece bought by /select in the episode is not charged again by finalize, and finalize still runs', async () => {
      const ids = await seed();
      await post('/select', { episode_id: ids.ep, wardrobe_id: ids.gown, show_id: ids.show });

      const result = await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);

      // The select row is the wardrobe's, not finalize's: finalize runs.
      expect(result.already_finalized).toBeUndefined();
      const rows = await q(`SELECT category, amount::float AS amount FROM financial_transactions
                             WHERE episode_id = :ep AND category = 'event_entry'`, ids);
      expect(rows.map((r) => r.amount)).toEqual([100]);
      const purchases = await purchaseRows(ids);
      expect(purchases.filter((r) => r.source_id === ids.gown)).toEqual([
        expect.objectContaining({ amount: 200, flow: 'select' }),
      ]);
      expect(purchases.filter((r) => r.source_id === ids.clutch)).toEqual([
        expect.objectContaining({ amount: 50, flow: null }),
      ]);
    });

    it('a piece bought by /purchase outside any episode is not charged again by finalize', async () => {
      const ids = await seed();
      await post('/purchase', { wardrobe_id: ids.clutch, show_id: ids.show });

      await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);

      const clutchRows = (await purchaseRows(ids)).filter((r) => r.source_id === ids.clutch);
      expect(clutchRows).toEqual([expect.objectContaining({ amount: 50, flow: 'purchase', episode_id: null })]);
    });

    it("a piece an earlier episode's finalize charged for is not charged again by the next", async () => {
      const ids = await seed();
      await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);

      // A second episode wearing the same snapshot (both pieces "unowned").
      const ep2 = uuid();
      const event2 = uuid();
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
                 VALUES (:ep2, :show, 'Second episode', 2, 'draft', NOW(), NOW())`, { ...ids, ep2 });
      await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, is_paid, payment_amount,
                   prestige, outfit_pieces, created_at, updated_at)
                 SELECT :event2, show_id, 'Second Gala', 'used', :ep2, 0, false, 0, 2, outfit_pieces, NOW(), NOW()
                   FROM world_events WHERE id = :event`, { ...ids, ep2, event2 });

      await finalizeEpisodeFinancials(ep2, ids.show, sequelize);

      const rows = await purchaseRows(ids);
      expect(rows.filter((r) => r.source_id === ids.gown)).toHaveLength(1);
      expect(rows.filter((r) => r.source_id === ids.clutch)).toHaveLength(1);
      expect(rows.some((r) => r.episode_id === ep2)).toBe(false);
    });
  });
});
