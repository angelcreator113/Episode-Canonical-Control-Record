/**
 * Deleting, restoring or superseding an episode syncs Lala's coins
 * (docs/EVENT_EPISODE_FLOW.md §8(aa) M6; Task #2284).
 *
 * Under M6 a deleted episode's ledger rows leave the balance, and a restored
 * episode's come back. Before this, those paths changed the balance without
 * syncing character_state.coins, so the cache lagged the ledger until the
 * next ledger write.
 *
 * Each show starts at 1000 (its seed) and has one episode carrying a 300
 * wardrobe purchase, so the ledger is 700 while the episode is live and 1000
 * once it is not.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { getCurrentBalance } = require('../../src/services/financialTransactionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('episode delete, restore and supersede sync Lala\'s coins (M6)', () => {
  const shows = [];
  let token;

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-ep-delete-sync', email: 'test@ep-delete-sync.dev', name: 'Episode Delete Sync',
      groups: ['USER', 'EDITOR', 'ADMIN'], role: 'ADMIN',
    }).accessToken;
  });

  async function seed() {
    const ids = { show: uuid(), ep: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { ...ids, name: `Delete sync ${ids.show.slice(0, 8)}`, slug: `dsync-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Purchase episode', 1, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, times_used, created_at, updated_at)
               VALUES (:event, :show, 'Delete Sync Gala', 'used', :ep, 1, NOW(), NOW())`, ids);
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, created_at, updated_at)
               VALUES (:id, :show, 'lala', 0, NOW(), NOW())`, { id: uuid(), show: ids.show });
    await run(`INSERT INTO financial_transactions (id, show_id, type, category, amount, status, created_at, updated_at)
               VALUES (:id, :show, 'income', 'seed', 1000, 'executed', NOW(), NOW())`, { id: uuid(), show: ids.show });
    await run(`INSERT INTO financial_transactions (id, show_id, episode_id, type, category, amount, status, metadata, created_at, updated_at)
               VALUES (:id, :show, :ep, 'expense', 'wardrobe_purchase', 300, 'executed', '{"flow":"select"}'::jsonb, NOW(), NOW())`,
      { id: uuid(), ...ids });
    await run(`UPDATE character_state SET coins = 700 WHERE show_id = :show`, ids);
    return ids;
  }

  const coins = async (show) => (await q(`SELECT coins FROM character_state WHERE show_id = :show AND character_key = 'lala'`, { show }))[0].coins;
  const expectCoinsEqualLedger = async (show, value) => {
    expect(await getCurrentBalance(sequelize, show)).toBe(value);
    expect(await coins(show)).toBe(value);
  };

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const show of shows) {
      const eps = `(SELECT id FROM episodes WHERE show_id = :show)`;
      for (const t of ['episode_briefs', 'scene_plans', 'episode_todo_lists']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn(`cleanup ${t}:`, err.message));
      }
      await run(`DELETE FROM financial_transactions WHERE show_id = :show`, { show });
      await run(`DELETE FROM character_state WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it('deleting an episode with a purchase: coins rise by it, with the ledger', async () => {
    const ids = await seed();
    await expectCoinsEqualLedger(ids.show, 700);

    const res = await request(app).delete(`/api/v1/episodes/${ids.ep}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    await expectCoinsEqualLedger(ids.show, 1000);
  });

  it('restoring it: coins fall back, with the ledger', async () => {
    const ids = await seed();
    await request(app).delete(`/api/v1/episodes/${ids.ep}`).set('Authorization', `Bearer ${token}`);
    await expectCoinsEqualLedger(ids.show, 1000);

    const episode = await models.Episode.findByPk(ids.ep, { paranoid: false });
    await episode.restore();

    const [row] = await q(`SELECT deleted_at FROM episodes WHERE id = :ep`, ids);
    expect(row.deleted_at).toBeNull();
    await expectCoinsEqualLedger(ids.show, 700);
  });

  it('a hard delete (outside production) syncs too', async () => {
    const ids = await seed();

    const res = await request(app).delete(`/api/v1/episodes/${ids.ep}?hard=true`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(await q(`SELECT id FROM episodes WHERE id = :ep`, ids)).toEqual([]);
    await expectCoinsEqualLedger(ids.show, 1000);
  });

  it('regenerating the episode supersedes it: coins equal the ledger', async () => {
    const ids = await seed();

    const res = await request(app)
      .post(`/api/v1/world/${ids.show}/events/${ids.event}/regenerate-episode`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.replaced_episode_id).toBe(ids.ep);
    // The purchase was on the superseded episode, so it leaves the balance.
    await expectCoinsEqualLedger(ids.show, 1000);
  });

  it('a delete that fails rolls back: the episode stays live and coins stay put', async () => {
    const ids = await seed();
    const coinLedgerSync = require('../../src/services/coinLedgerSync');
    jest.spyOn(coinLedgerSync, 'syncCoinsAfterEpisodeChange').mockRejectedValue(new Error('injected sync failure'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const episode = await models.Episode.findByPk(ids.ep);
    await expect(episode.softDelete()).rejects.toThrow('injected sync failure');

    const [row] = await q(`SELECT deleted_at FROM episodes WHERE id = :ep`, ids);
    expect(row.deleted_at).toBeNull();
    await expectCoinsEqualLedger(ids.show, 700);
  });
});
