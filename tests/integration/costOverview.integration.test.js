/**
 * The cost page's endpoint (GET /api/v1/ai-usage/cost-overview, ADMIN;
 * services/costOverview; Evoni, 2026-10-19): today against both budgets
 * read the way the gates read them, spend by feature with unpriced calls
 * counted (never $0), the daily series, the top lists and post pictures.
 * A non-admin is refused. The Daily update carries the budget warnings.
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

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('the cost page (Evoni, 2026-10-19)', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const sceneRoute = `svc:sceneCostTest${tag}`;
  const otherRoute = `zz-cost-test-${tag}`;
  let admin;
  let user;
  const get = (token, q = '') => request(app).get(`/api/v1/ai-usage/cost-overview${q}`).set('Authorization', `Bearer ${token}`);
  const insert = (route, { cost, image = false, ago = 0 }) => run(
    `INSERT INTO ai_usage_logs (route_name, model_name, input_tokens, output_tokens, cost_usd, is_error, billing_unit, billed_units, provider, created_at)
     VALUES (:route, :model, 0, 0, :cost, false, :unit, :units, :provider, NOW() - (:ago || ' days')::interval)`,
    { route, model: image ? 'gpt-image-1.5' : 'claude-sonnet-4-6', cost, unit: image ? 'image' : null, units: image ? 1 : null, provider: image ? 'openai' : null, ago: String(ago) });

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-cost', email: 'evoni@cost.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    user = TokenService.generateTokenPair({ id: 'test-user-cost', email: 'user@cost.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    await insert(sceneRoute, { cost: 0.2, image: true });
    await insert(sceneRoute, { cost: 0.2, image: true });
    await insert(otherRoute, { cost: 0.05 });
    await insert(otherRoute, { cost: null, image: true });          // unpriced: counted, never $0 of spend
    await insert(otherRoute, { cost: 0.7, ago: 2 });                  // two days ago
  });

  afterAll(async () => {
    await run('DELETE FROM ai_usage_logs WHERE route_name IN (:routes)', { routes: [sceneRoute, otherRoute] });
  });

  test('a non-admin is refused; signed out is 401', async () => {
    expect((await get(user)).status).toBe(403);
    expect((await request(app).get('/api/v1/ai-usage/cost-overview')).status).toBe(401);
  });

  test('today against both budgets, as the gates read them', async () => {
    const res = await get(admin);
    expect(res.status).toBe(200);
    const d = res.body.data;
    const imageCost = require('../../src/services/imageCostService');
    const tracker = require('../../src/services/aiCostTracker');
    const spend = await imageCost.readTodaySpend();
    expect(d.budgets.read_ok).toBe(true);
    expect(d.budgets.all.cap_usd).toBe(tracker.DAILY_BUDGET);
    expect(d.budgets.images.cap_usd).toBe(imageCost.dailyImageBudget());
    expect(d.budgets.images.spent_usd).toBeCloseTo(spend.image, 4);
    expect(d.budgets.all.spent_usd).toBeGreaterThanOrEqual(0.45 - 1e-9);
    expect(d.budgets.images.spent_usd).toBeGreaterThanOrEqual(0.4 - 1e-9);
    expect(['ok', 'warn', 'over']).toContain(d.budgets.all.level);
    expect(d.today.unpriced_calls).toBeGreaterThanOrEqual(1);
  });

  test('spend by feature: our scene images and Other, with the unpriced call named', async () => {
    const d = (await get(admin)).body.data;
    const scene = d.features.today.find((f) => f.key === 'scene_images');
    expect(scene.routes.find((r) => r.route_name === sceneRoute)).toEqual({ route_name: sceneRoute, usd: 0.4 });
    expect(scene.image_calls).toBeGreaterThanOrEqual(2);
    const other = d.features.today.find((f) => f.key === 'other');
    expect(other.routes.find((r) => r.route_name === otherRoute).usd).toBeCloseTo(0.05, 6);
    expect(other.unpriced_calls).toBeGreaterThanOrEqual(1);
    // Two days ago counts in the range, not today.
    const otherRange = d.features.range.find((f) => f.key === 'other');
    expect(otherRange.routes.find((r) => r.route_name === otherRoute).usd).toBeCloseTo(0.75, 6);
  });

  test('the daily series: one row per day, oldest first, today last; top lists', async () => {
    const d = (await get(admin, '?days=7')).body.data;
    expect(d.days).toBe(7);
    expect(d.daily).toHaveLength(7);
    expect(d.daily[6].day).toBe(new Date().toISOString().slice(0, 10));
    expect(d.daily[6].image_usd).toBeGreaterThanOrEqual(0.4 - 1e-9);
    expect(d.daily[4].text_usd).toBeGreaterThanOrEqual(0.7 - 1e-9);
    expect(d.top_days.length).toBeGreaterThan(0);
    expect(d.top_days.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < d.top_days.length; i += 1) expect(d.top_days[i - 1].total_usd).toBeGreaterThanOrEqual(d.top_days[i].total_usd);
    expect(d.top_features.length).toBeLessThanOrEqual(5);
  });

  test('post pictures: today against the limit; waiting only where the column exists', async () => {
    const d = (await get(admin)).body.data;
    const [cols] = await run(`SELECT 1 FROM information_schema.columns WHERE table_name = 'feed_posts' AND column_name = 'picture_job'`);
    expect(d.post_pictures.limit).toBe(require('../../src/services/costOverview').postPictureLimit());
    expect(typeof d.post_pictures.made_today).toBe('number');
    expect(d.post_pictures.waiting_available).toBe(cols.length > 0);
    if (!cols.length) expect(d.post_pictures.waiting).toBeNull();
  });

  test('the Daily update carries both budgets and the warnings', async () => {
    const res = await request(app).get('/api/v1/daily-update').set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    expect(res.body.cost.image_budget_usd).toBe(require('../../src/services/imageCostService').dailyImageBudget());
    expect(Array.isArray(res.body.cost.alerts)).toBe(true);
  });
});
