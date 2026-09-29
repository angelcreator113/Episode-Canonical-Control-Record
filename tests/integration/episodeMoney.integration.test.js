/**
 * Episode Money, Phase A: GET /world/:showId/episodes/:episodeId/money
 * (docs/EVENT_EPISODE_FLOW.md §8(aa) M1–M5; Task #2278).
 *
 * The show starts at 1000. Its episode's source event is paid (payment 200)
 * with an entry cost of 100. A wardrobe purchase (select, 300) is made in
 * the episode, then Finalize books the event.
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
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Episode Money, Phase A (M1–M5)', () => {
  const shows = [];
  let token;

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-episode-money', email: 'test@episode-money.dev', name: 'Episode Money',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  async function seed({ isPaid = false, payment = 0, cost = 100 } = {}) {
    const ids = { show: uuid(), ep: uuid(), event: uuid(), otherEp: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { ...ids, name: `Money ${ids.show.slice(0, 8)}`, slug: `money-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Money episode', 1, 'draft', NOW(), NOW()),
                      (:otherEp, :show, 'Other episode', 2, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, is_paid, payment_amount,
                 prestige, created_at, updated_at)
               VALUES (:event, :show, 'Money Gala', 'used', :ep, :cost, :isPaid, :payment, 5, NOW(), NOW())`,
      { ...ids, cost, isPaid, payment });
    const dress = await models.Wardrobe.create({ name: 'Gold Gown', clothing_category: 'dress', show_id: ids.show, lock_type: 'coin', coin_cost: 300, is_owned: false });
    ids.dress = dress.id;
    await models.CharacterState.create({ show_id: ids.show, character_key: 'lala', coins: 0, reputation: 5 });
    return ids;
  }

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const money = (ids, ep = ids.ep) => auth(request(app).get(`/api/v1/world/${ids.show}/episodes/${ep}/money`));

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
      await run(`DELETE FROM episode_wardrobe WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show });
      await run(`DELETE FROM character_state_history WHERE show_id = :show`, { show });
      await run(`DELETE FROM character_state WHERE show_id = :show`, { show });
      await run(`DELETE FROM wardrobe WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it('an episode with a purchase and a Finalize shows those rows and its net', async () => {
    const ids = await seed();
    const buy = await auth(request(app).post('/api/v1/wardrobe/select'))
      .send({ episode_id: ids.ep, wardrobe_id: ids.dress, show_id: ids.show });
    expect(buy.status).toBe(200);
    await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);

    const res = await money(ids);

    expect(res.status).toBe(200);
    const { rows, net, balance } = res.body.data;
    expect(rows.find((r) => r.category === 'wardrobe_purchase')).toMatchObject({ amount: 300, signed: -300 });
    expect(rows.find((r) => r.category === 'event_entry')).toMatchObject({ amount: 100, signed: -100 });
    expect(net).toBe(rows.reduce((s, r) => s + r.signed, 0));
    expect(balance).toBe(await getCurrentBalance(sequelize, ids.show));
    expect(balance).toBe(1000 + net);
  });

  it('voided rows and rows of a deleted episode are excluded (M6)', async () => {
    const ids = await seed();
    await run(`INSERT INTO financial_transactions (id, show_id, episode_id, type, category, amount, status, created_at, updated_at)
               VALUES (:a, :show, :ep, 'expense', 'wardrobe_purchase', 50, 'executed', NOW(), NOW()),
                      (:b, :show, :ep, 'expense', 'wardrobe_purchase', 70, 'voided', NOW(), NOW())`,
      { ...ids, a: uuid(), b: uuid() });

    const res = await money(ids);
    expect(res.body.data.rows.map((r) => r.amount)).toEqual([50]);
    expect(res.body.data.net).toBe(-50);

    await run(`UPDATE episodes SET deleted_at = NOW() WHERE id = :ep`, ids);
    const gone = await money(ids);
    expect(gone.status).toBe(404);
  });

  it("another episode's rows are not this episode's", async () => {
    const ids = await seed();
    await run(`INSERT INTO financial_transactions (id, show_id, episode_id, type, category, amount, status, created_at, updated_at)
               VALUES (:a, :show, :otherEp, 'expense', 'wardrobe_purchase', 40, 'executed', NOW(), NOW())`, { ...ids, a: uuid() });

    const res = await money(ids);
    expect(res.body.data.rows).toEqual([]);
    expect(res.body.data.net).toBe(0);
  });

  it('expected terms are listed apart and never change the balance or the net (M2)', async () => {
    const ids = await seed({ isPaid: true, payment: 200, cost: 0 });
    const before = await getCurrentBalance(sequelize, ids.show);

    const res = await money(ids);

    expect(res.body.data.event).toMatchObject({ id: ids.event, name: 'Money Gala' });
    expect(res.body.data.expected).toEqual([{ kind: 'income', label: 'Event payment', amount: 200, source: 'terms' }]);
    expect(res.body.data.rows).toEqual([]);
    expect(res.body.data.net).toBe(0);
    expect(res.body.data.balance).toBe(before);
    expect(await getCurrentBalance(sequelize, ids.show)).toBe(before);
  });

  it("the balance matches the Dashboard's /balance", async () => {
    const ids = await seed();
    await auth(request(app).post('/api/v1/wardrobe/select')).send({ episode_id: ids.ep, wardrobe_id: ids.dress, show_id: ids.show });

    const [m, dashboard] = await Promise.all([money(ids), auth(request(app).get(`/api/v1/world/${ids.show}/balance`))]);

    expect(m.body.data.balance).toBe(dashboard.body.balance);
  });

  it('an episode of another show is not found', async () => {
    const ids = await seed();
    const other = await seed();

    const res = await money(ids, other.ep);

    expect(res.status).toBe(404);
  });
});
