/**
 * A wardrobe outfit lock never makes finalize skip the episode's entry cost,
 * payment or rewards (docs/EVENT_EPISODE_FLOW.md §8(x) D3; Task #2229).
 *
 * POST /wardrobe/lock-outfit-atomic books its purchases against the episode.
 * finalizeEpisodeFinancials counted ANY executed ledger row on the episode as
 * "already finalized", so after a lock it booked nothing at all.
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

(shouldSkip ? describe.skip : describe)('an outfit lock does not make finalize skip (§8(x) D3)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-lock-finalize',
      email: 'test@lock-finalize.dev',
      name: 'Lock Finalize Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
  });

  // An unpaid event (entry 100) linked to the episode, whose outfit is two
  // coin-locked, unowned pieces: the gown (200) and the clutch (50).
  async function seed() {
    const ids = { show: uuid(), ep: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Lock show ${ids.show.slice(0, 8)}`, slug: `lkf-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Lock episode', 1, 'draft', NOW(), NOW())`, ids);
    const gown = await models.Wardrobe.create({ name: 'Gold Gown', clothing_category: 'dress', show_id: ids.show, lock_type: 'coin', coin_cost: 200, is_owned: false });
    const clutch = await models.Wardrobe.create({ name: 'Pearl Clutch', clothing_category: 'accessories', show_id: ids.show, lock_type: 'coin', coin_cost: 50, is_owned: false });
    ids.gown = gown.id;
    ids.clutch = clutch.id;
    await models.CharacterState.create({ show_id: ids.show, character_key: 'lala', coins: 1000, reputation: 5 });
    const outfit = [
      { id: ids.gown, name: 'Gold Gown', coin_cost: 200, is_owned: false },
      { id: ids.clutch, name: 'Pearl Clutch', coin_cost: 50, is_owned: false },
    ];
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, is_paid, payment_amount,
                 prestige, outfit_pieces, created_at, updated_at)
               VALUES (:event, :show, 'Lock Gala', 'used', :ep, 100, false, 0, 2, CAST(:outfit AS jsonb), NOW(), NOW())`,
      { ...ids, outfit: JSON.stringify(outfit) });
    return ids;
  }

  const ledger = (ids) => q(
    `SELECT category, amount::float AS amount, source_id, metadata->>'flow' AS flow
       FROM financial_transactions WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY created_at`, ids);

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

  it('after locking one piece, finalize still books the entry cost and charges only the unlocked piece', async () => {
    const ids = await seed();

    const lock = await request(app)
      .post('/api/v1/wardrobe/lock-outfit-atomic')
      .set('Authorization', `Bearer ${token}`)
      .send({ episode_id: ids.ep, show_id: ids.show, wardrobe_ids: [ids.gown] });
    expect(lock.status).toBe(200);

    const result = await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);

    expect(result.already_finalized).toBeUndefined();
    const rows = await ledger(ids);
    expect(rows.filter((r) => r.category === 'event_entry').map((r) => r.amount)).toEqual([100]);
    // The gown is charged once, by the lock; the clutch once, by finalize.
    const purchases = rows.filter((r) => r.category === 'wardrobe_purchase');
    expect(purchases).toHaveLength(2);
    expect(purchases.filter((r) => r.source_id === ids.gown)).toEqual([
      expect.objectContaining({ amount: 200, flow: 'lock_outfit' }),
    ]);
    expect(purchases.filter((r) => r.source_id === ids.clutch)).toEqual([
      expect.objectContaining({ amount: 50, flow: null }),
    ]);
  });

  it('a second finalize is still recognised as already finalized', async () => {
    const ids = await seed();
    await request(app)
      .post('/api/v1/wardrobe/lock-outfit-atomic')
      .set('Authorization', `Bearer ${token}`)
      .send({ episode_id: ids.ep, show_id: ids.show, wardrobe_ids: [ids.gown] });
    await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
    const countAfterFirst = (await ledger(ids)).length;

    const again = await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);

    expect(again.already_finalized).toBe(true);
    expect((await ledger(ids)).length).toBe(countAfterFirst);
  });
});
