/**
 * An episode's estimated money prices the chosen look, never the closet
 * (Task #1919). Start Episode (generate-episode) priced every item in the
 * show's wardrobe as the outfit, so a new episode's total_expenses carried
 * the whole closet. Now: with no outfit chosen, the outfit cost is absent
 * and the expenses are the event's cost alone; with a chosen look, only its
 * pieces Finalize would charge for count.
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
const rows = async (sql, replacements = {}) => (await run(sql, replacements))[0];

(shouldSkip ? describe.skip : describe)('the episode estimate prices the chosen look (Task #1919)', () => {
  const show = uuid();
  const closet = { gown: uuid(), coat: uuid(), boots: uuid(), heels: uuid() };
  let token;
  const start = (eventId) => request(app).post(`/api/v1/world/${show}/events/${eventId}/generate-episode`)
    .set('Authorization', `Bearer ${token}`).send({ draft_script: false });

  async function event(outfitPieces = null) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, is_paid, payment_amount, cost_coins, outfit_pieces, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', 'ready', 5, true, 500, 100, CAST(:pieces AS jsonb), NOW(), NOW())`,
    { id, show, name: `Closet Gala ${id.slice(0, 6)}`, pieces: outfitPieces ? JSON.stringify(outfitPieces) : null });
    return id;
  }

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-user-pnl-look', email: 'evoni@pnl-look.dev', name: 'PnL Look', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `PnL ${show.slice(0, 8)}`, slug: `pnl-${show.slice(0, 8)}` });
    // A closet worth 5000 coins, none of it chosen for these episodes.
    for (const [key, cost] of [['gown', 2000], ['coat', 1500], ['boots', 1000], ['heels', 500]]) {
      await run(`INSERT INTO wardrobe (id, name, clothing_category, show_id, coin_cost, is_owned, created_at, updated_at)
                 VALUES (:id, :name, 'dress', :show, :cost, false, NOW(), NOW())`, { id: closet[key], name: key, show, cost });
    }
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    const eps = '(SELECT id FROM episodes WHERE show_id = :show)';
    for (const t of ['episode_briefs', 'scene_plans', 'episode_todo_lists', 'scene_set_episodes']) {
      await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn(`cleanup ${t}:`, err.message));
    }
    await run('DELETE FROM world_events WHERE show_id = :show', { show });
    await run('DELETE FROM episodes WHERE show_id = :show', { show });
    await run('DELETE FROM wardrobe WHERE show_id = :show', { show });
    await run('DELETE FROM shows WHERE id = :show', { show });
  });

  const money = async (episodeId) => {
    const [ep] = await rows('SELECT total_income, total_expenses FROM episodes WHERE id = :episodeId', { episodeId });
    const [todo] = await rows('SELECT financial_summary FROM episode_todo_lists WHERE episode_id = :episodeId', { episodeId });
    const fin = typeof todo.financial_summary === 'string' ? JSON.parse(todo.financial_summary) : todo.financial_summary;
    return { income: parseFloat(ep.total_income), expenses: parseFloat(ep.total_expenses), fin };
  };

  it('no outfit chosen: the closet is not the outfit; the cost is the event\'s alone and the outfit cost is absent', async () => {
    const res = await start(await event());
    expect(res.status).toBe(201);
    const { income, expenses, fin } = await money(res.body.episode?.id || res.body.data?.episode?.id);
    expect(expenses).toBe(100);
    expect(income).toBe(500);
    expect(fin).toMatchObject({ outfit_cost: null, outfit_chosen: false, event_expense: 100, total_expenses: 100 });
  });

  it('a chosen look counts only what Finalize would charge: an owned piece is free', async () => {
    const res = await start(await event([
      { id: closet.coat, name: 'coat', coin_cost: 1500, is_owned: false },
      { id: closet.heels, name: 'heels', coin_cost: 500, is_owned: true },
    ]));
    expect(res.status).toBe(201);
    const { expenses, fin } = await money(res.body.episode?.id || res.body.data?.episode?.id);
    expect(fin).toMatchObject({ outfit_cost: 1500, outfit_chosen: true });
    expect(expenses).toBe(1600);
  });
});
