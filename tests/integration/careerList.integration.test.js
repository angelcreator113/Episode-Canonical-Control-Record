/**
 * Lala's Career list (Task #3181), against the test database: goals as of
 * an episode, milestones, brands worked with from the events and deals of
 * episodes accepted before it, and the per-brand hide in show settings.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { careerListAt } = require('../../src/services/careerListService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Career list (Task #3181)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), ep1: uuid(), ep2: uuid(), ep3: uuid(), gone: uuid() };
  let token;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-user-career-list', email: 'ed@career-list.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { show: ids.show, name: `Career ${tag}`, slug: `career-${tag}` });
    const ep = (id, n, status, done) => run(
      `INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, evaluation_json, created_at, updated_at)
       VALUES (:id, :show, :title, :n, 'published', :status, CAST(:json AS jsonb), NOW(), NOW())`,
      { id, show: ids.show, title: `Episode ${n}`, n, status, json: JSON.stringify(done ? { completed_at: done } : {}) });
    await ep(ids.ep1, 1, 'accepted', '2026-10-01T10:00:00Z');
    await ep(ids.ep2, 2, 'accepted', '2026-10-05T10:00:00Z');
    await ep(ids.ep3, 3, null, null);
    // A deleted accepted episode never counts.
    await ep(ids.gone, 0, 'accepted', '2026-09-01T00:00:00Z');
    await run('UPDATE episodes SET deleted_at = NOW() WHERE id = :id', { id: ids.gone });

    const event = (episode, hostBrand, host) => run(
      `INSERT INTO world_events (id, show_id, name, event_type, host, host_brand, status, used_in_episode_id, created_at, updated_at)
       VALUES (:id, :show, :name, 'invite', :host, :hostBrand, 'used', :episode, NOW(), NOW())`,
      { id: uuid(), show: ids.show, name: `Event ${tag} ${host}`, host, hostBrand, episode });
    await event(ids.ep1, null, 'STUDIO BY SABLE');
    await event(ids.ep2, 'Maison Belle', 'Belle');
    await event(ids.ep3, 'Too Soon Co', 'Soon');     // this episode: not yet worked with
    await event(ids.gone, 'Gone Brand', 'Gone');     // a deleted episode: never

    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, brand_or_company, career_milestone, episode_id, created_at, updated_at)
               VALUES (:id, :show, 'Velour cover', 'magazine', 'completed', 'Velour Magazine', 'First magazine cover', :ep, NOW(), NOW())`,
    { id: uuid(), show: ids.show, ep: ids.ep2 });

    const goal = (title, status, completedAt) => run(
      `INSERT INTO career_goals (id, show_id, title, type, target_metric, target_value, current_value, status, priority, completed_at, created_at, updated_at)
       VALUES (:id, :show, :title, 'secondary', 'reputation', 5, 0, :status, 3, :completedAt, NOW(), NOW())`,
      { id: uuid(), show: ids.show, title, status, completedAt });
    await goal('First cover', 'completed', '2026-10-04T00:00:00Z');
    await goal('Ten thousand followers', 'completed', '2026-10-09T00:00:00Z');
    await goal('Save 2,000 coins', 'active', null);
    await goal('A failed one', 'failed', null);
  });

  afterAll(async () => {
    await run('DELETE FROM career_goals WHERE show_id = :show', ids);
    await run('DELETE FROM opportunities WHERE show_id = :show', ids);
    await run('DELETE FROM world_events WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('as of Episode 3: goals completed by Episode 2, brands from Episodes 1 and 2 only, the deal milestone', async () => {
    const list = await careerListAt(models, ids.show, { episodeId: ids.ep3 });
    expect(list.goals.map((g) => [g.title, g.status])).toEqual(expect.arrayContaining([
      ['First cover', 'completed'], ['Ten thousand followers', 'active'], ['Save 2,000 coins', 'active'],
    ]));
    expect(list.goals.map((g) => g.title)).not.toContain('A failed one');
    expect(list.brands.map((b) => [b.name, b.episodes.map((e) => e.number)])).toEqual([
      ['STUDIO BY SABLE', [1]], ['Maison Belle', [2]], ['Velour Magazine', [2]],
    ]);
    expect(list.milestones).toEqual(expect.arrayContaining([
      { kind: 'goal', title: 'First cover' },
      expect.objectContaining({ kind: 'opportunity', title: 'First magazine cover' }),
    ]));
  });

  test('the routes: auth, the list, and a hidden brand left out but listed', async () => {
    const url = `/api/v1/shows/${ids.show}/career-list`;
    expect((await request(app).get(url)).status).toBe(401);
    const auth = (req) => req.set('Authorization', `Bearer ${token}`);
    const hide = await auth(request(app).put(`${url}/hidden-brands`)).send({ brands: ['velour magazine'] });
    expect(hide.body.data.hidden_brands).toEqual(['velour magazine']);
    const res = await auth(request(app).get(`${url}?episode_id=${ids.ep3}`));
    expect(res.status).toBe(200);
    expect(res.body.data.brands.map((b) => b.name)).toEqual(['STUDIO BY SABLE', 'Maison Belle']);
    expect(res.body.data.hidden_brands).toEqual(['velour magazine']);
    expect((await auth(request(app).put(`${url}/hidden-brands`)).send({ brands: 'x' })).status).toBe(400);
    expect((await auth(request(app).get(`${url}?episode_id=${uuid()}`))).status).toBe(404);
  });
});
