/**
 * Coins never come from ticking a task (docs/EVENT_EPISODE_FLOW.md §8(bb)
 * T3; Task #2263).
 *
 * finalizeEpisodeFinancials paid every completed social task (required 25,
 * optional 10, times a timing multiplier) as a `social_task_reward` ledger
 * row, and the financial forecast projected the same income. Contract pay
 * belongs to deliverable status (§8(z) Law 8), not to a tick.
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

const TASKS = [
  { slot: 'grwm', label: 'Get Ready With Me', platform: 'tiktok', timing: 'before', required: true, completed: true },
  { slot: 'live', label: 'Go live', platform: 'instagram', timing: 'during', required: false, completed: true },
];

(shouldSkip ? describe.skip : describe)('coins never come from ticking a task (§8(bb) T3)', () => {
  const shows = [];
  let token;

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-t3', email: 'test@t3.dev', name: 'T3 Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  async function seed() {
    const ids = { show: uuid(), ep: uuid(), event: uuid(), todo: uuid() };
    shows.push(ids.show);
    const automation = JSON.stringify({ automation: { social_tasks: TASKS } });
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { ...ids, name: `T3 ${ids.show.slice(0, 8)}`, slug: `t3-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'T3 episode', 1, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, is_paid, payment_amount,
                 prestige, canon_consequences, created_at, updated_at)
               VALUES (:event, :show, 'T3 Gala', 'used', :ep, 100, false, 0, 5, CAST(:automation AS jsonb), NOW(), NOW())`,
      { ...ids, automation });
    await run(`INSERT INTO episode_todo_lists (id, episode_id, show_id, event_id, tasks, social_tasks, status, created_at, updated_at)
               VALUES (:todo, :ep, :show, :event, '[]'::jsonb, CAST(:tasks AS jsonb), 'generated', NOW(), NOW())`,
      { ...ids, tasks: JSON.stringify(TASKS) });
    return ids;
  }

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
      await run(`DELETE FROM episode_todo_lists WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it('finalize books no coins for completed social tasks', async () => {
    const ids = await seed();

    const result = await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);

    const rows = await q(`SELECT category FROM financial_transactions WHERE show_id = :show`, ids);
    expect(rows.map((r) => r.category)).toContain('event_entry');
    expect(rows.filter((r) => r.category === 'social_task_reward')).toEqual([]);
    expect(result.summary.social_task_rewards).toBeUndefined();
  });

  it('the financial forecast projects no income from social tasks', async () => {
    const ids = await seed();

    const res = await request(app)
      .get(`/api/v1/world/${ids.show}/events/${ids.event}/financial-forecast`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { income } = res.body;
    expect(income).toBeDefined();
    expect(income.social_task_rewards).toBeUndefined();
    expect(income.total).toBe(income.event_payment + income.content_revenue_est);
  });
});
