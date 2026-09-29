/**
 * T7 (docs/EVENT_EPISODE_FLOW.md §8(bb); Task #2307): a wardrobe task's
 * completion comes from Lala's outfit, with no manual toggle that gets
 * silently overwritten.
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
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

const WARDROBE_TASKS = [
  { slot: 'dress', label: 'Outfit', required: true, completed: false },
  { slot: 'shoes', label: 'Shoes', required: true, completed: false },
  { slot: 'jewelry', label: 'Jewelry', required: false, completed: true }, // a stale manual toggle
];
const SOCIAL_TASKS = [{ slot: 'grwm', label: 'GRWM', task_source: 'goal', required: false, completed: false }];

(shouldSkip ? describe.skip : describe)('wardrobe completion comes from the outfit (T7)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-t7', email: 'test@t7.dev', name: 'T7', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const show of shows) {
      const eps = `(SELECT id FROM episodes WHERE show_id = :show)`;
      await run(`DELETE FROM episode_wardrobe WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn('cleanup episode_wardrobe:', err.message));
      await run(`DELETE FROM episode_todo_lists WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn('cleanup todo:', err.message));
      await run(`DELETE FROM wardrobe WHERE show_id = :show`, { show }).catch((err) => console.warn('cleanup wardrobe:', err.message));
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  async function seed() {
    const ids = { show: uuid(), ep: uuid(), dress: uuid(), shoes: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `T7 show ${ids.show.slice(0, 8)}`, slug: `t7-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Gala Night', 1, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO episode_todo_lists (id, episode_id, show_id, tasks, social_tasks, status, created_at, updated_at)
               VALUES (:id, :ep, :show, CAST(:tasks AS jsonb), CAST(:social AS jsonb), 'generated', NOW(), NOW())`,
      { ...ids, id: uuid(), tasks: JSON.stringify(WARDROBE_TASKS), social: JSON.stringify(SOCIAL_TASKS) });
    // The dress is chosen; the shoes were chosen and then rejected.
    await run(`INSERT INTO wardrobe (id, show_id, name, clothing_category, created_at, updated_at)
               VALUES (:dress, :show, 'Silk slip dress', 'dress', NOW(), NOW()), (:shoes, :show, 'Gold heels', 'shoes', NOW(), NOW())`, ids);
    await run(`INSERT INTO episode_wardrobe (id, episode_id, wardrobe_id, approval_status, created_at, updated_at)
               VALUES (:a, :ep, :dress, 'approved', NOW(), NOW()), (:b, :ep, :shoes, 'rejected', NOW(), NOW())`,
      { ...ids, a: uuid(), b: uuid() });
    return ids;
  }

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const storedTasks = async (ids) => asJson((await q(`SELECT tasks FROM episode_todo_lists WHERE episode_id = :ep`, ids))[0].tasks);

  it('completion is the outfit: a chosen piece fills its slot; a rejected one or a stale toggle does not', async () => {
    const ids = await seed();
    const res = await request(app).get(`/api/v1/episodes/${ids.ep}/todo`).set(auth());
    expect(res.status).toBe(200);
    const bySlot = Object.fromEntries(res.body.data.tasks.map((t) => [t.slot, t.completed]));
    expect(bySlot).toEqual({ dress: true, shoes: false, jewelry: false });
  });

  it('a wardrobe slot has no manual toggle: 409, and nothing is written', async () => {
    const ids = await seed();
    const res = await request(app).post(`/api/v1/episodes/${ids.ep}/todo/complete/shoes`).set(auth()).send({ completed: true });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('WARDROBE_COMPLETION_DERIVED');
    expect(await storedTasks(ids)).toEqual(WARDROBE_TASKS);
  });

  it('a social slot is still completed through the same route', async () => {
    const ids = await seed();
    const res = await request(app).post(`/api/v1/episodes/${ids.ep}/todo/complete/grwm`).set(auth()).send({ completed: true });
    expect(res.status).toBe(200);
    expect(res.body.social_tasks.find((t) => t.slot === 'grwm').completed).toBe(true);
    expect(await storedTasks(ids)).toEqual(WARDROBE_TASKS);
  });

  it('an unknown slot is a 404', async () => {
    const ids = await seed();
    const res = await request(app).post(`/api/v1/episodes/${ids.ep}/todo/complete/nope`).set(auth()).send({ completed: true });
    expect(res.status).toBe(404);
  });
});
