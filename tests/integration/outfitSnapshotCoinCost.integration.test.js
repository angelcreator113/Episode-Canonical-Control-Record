/**
 * The event outfit snapshot carries coin_cost, so Finalize charges it
 * (Task #2346, from the wardrobe price read #2344).
 *
 * PUT /world/:showId/events/:eventId/outfit writes the event's outfit_pieces.
 * Finalize charges each unowned, bought piece `coin_cost || price` from that
 * snapshot (financialTransactionService finalize, step 7). The route stored
 * price and no coin_cost, so Finalize charged the real-world price instead
 * of the story coin_cost that select, purchase and lock charge.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { finalizeEpisodeFinancials } = require('../../src/services/financialTransactionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

(shouldSkip ? describe.skip : describe)('outfit snapshot carries coin_cost; Finalize charges it (Task #2346)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-outfit-coin-cost', email: 'test@outfit-coin-cost.dev', name: 'Outfit Coin Cost Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM financial_transactions WHERE show_id = :show`, { show });
      await run(`DELETE FROM character_state_history WHERE show_id = :show`, { show }).catch((err) => console.warn('cleanup history:', err.message));
      await run(`DELETE FROM character_state WHERE show_id = :show`, { show });
      await run(`DELETE FROM wardrobe WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  // A free event linked to the episode, and one unowned piece whose story
  // coin_cost (120) differs from its real-world price (450).
  async function seed() {
    const ids = { show: uuid(), ep: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Outfit coin ${ids.show.slice(0, 8)}`, slug: `occ-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Outfit episode', 1, 'draft', NOW(), NOW())`, ids);
    const gown = await models.Wardrobe.create({
      name: 'Velvet Gown', clothing_category: 'dress', show_id: ids.show,
      price: 450, coin_cost: 120, lock_type: 'coin', is_owned: false, acquisition_type: 'purchased',
    });
    ids.gown = gown.id;
    await models.CharacterState.create({ show_id: ids.show, character_key: 'lala', coins: 1000, reputation: 5 });
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, is_paid, payment_amount,
                 prestige, created_at, updated_at)
               VALUES (:event, :show, 'Velvet Gala', 'used', :ep, 0, false, 0, 2, NOW(), NOW())`, ids);
    return ids;
  }

  it('the snapshot stores coin_cost, and Finalize charges it rather than the price', async () => {
    const ids = await seed();
    const res = await request(app)
      .put(`/api/v1/world/${ids.show}/events/${ids.event}/outfit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ wardrobe_ids: [ids.gown] });
    expect(res.status).toBe(200);

    const [event] = await q(`SELECT outfit_pieces FROM world_events WHERE id = :event`, ids);
    expect(asJson(event.outfit_pieces)).toEqual([expect.objectContaining({ id: ids.gown, price: 450, coin_cost: 120 })]);

    await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
    const purchases = await q(
      `SELECT amount::float AS amount FROM financial_transactions
        WHERE episode_id = :ep AND category = 'wardrobe_purchase' AND source_id = :gown AND deleted_at IS NULL`, ids);
    expect(purchases).toEqual([{ amount: 120 }]);
  });

  it('a piece whose coin_cost is 0 is not charged its price', async () => {
    const ids = await seed();
    await run(`UPDATE wardrobe SET coin_cost = 0 WHERE id = :gown`, ids);
    const res = await request(app)
      .put(`/api/v1/world/${ids.show}/events/${ids.event}/outfit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ wardrobe_ids: [ids.gown] });
    expect(res.status).toBe(200);
    await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
    const purchases = await q(
      `SELECT amount::float AS amount FROM financial_transactions
        WHERE episode_id = :ep AND category = 'wardrobe_purchase' AND deleted_at IS NULL`, ids);
    expect(purchases).toEqual([]);
  });

  it('an older snapshot with no coin_cost still charges its price', async () => {
    const ids = await seed();
    const legacy = [{ id: ids.gown, name: 'Velvet Gown', price: 450, is_owned: false, acquisition_type: 'purchased' }];
    await run(`UPDATE world_events SET outfit_pieces = CAST(:outfit AS jsonb) WHERE id = :event`, { ...ids, outfit: JSON.stringify(legacy) });
    await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
    const purchases = await q(
      `SELECT amount::float AS amount FROM financial_transactions
        WHERE episode_id = :ep AND category = 'wardrobe_purchase' AND deleted_at IS NULL`, ids);
    expect(purchases).toEqual([{ amount: 450 }]);
  });
});
