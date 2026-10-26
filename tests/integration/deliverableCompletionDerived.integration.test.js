/**
 * A deliverable's task is never ticked by hand (Evoni, 2026-10-26): both
 * manual tick routes answer 409 for it and leave the list as it was;
 * submitting the deliverable through its own status route ticks it, in the
 * same transaction; a goal still ticks by hand; no coin, ledger or
 * deliverable write comes from a tick.
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

(shouldSkip ? describe.skip : describe)('a deliverable completes when it is submitted, never by a manual tick', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-dcd', email: 'test@dcd.dev', name: 'DCD', groups: ['USER', 'EDITOR', 'ADMIN'], role: 'ADMIN',
    }).accessToken;
  });

  afterAll(async () => {
    for (const show of shows) {
      const eps = `(SELECT id FROM episodes WHERE show_id = :show)`;
      await run(`DELETE FROM episode_todo_lists WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn('cleanup todo:', err.message));
      await run(`DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show }).catch((err) => console.warn('cleanup deliverables:', err.message));
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show }).catch((err) => console.warn('cleanup events:', err.message));
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  async function seed() {
    const ids = { show: uuid(), ep: uuid(), event: uuid(), d: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `DCD show ${ids.show.slice(0, 8)}`, slug: `dcd-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Studio Day', 1, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, used_in_episode_id, created_at, updated_at)
               VALUES (:event, :show, 'Studio Session', :ep, NOW(), NOW())`, ids);
    await run(`INSERT INTO event_deliverables (id, event_id, description, deliverable_type, quantity, status, episode_id, created_at, updated_at)
               VALUES (:d, :event, 'One reel in the coat', 'pulse_video', 1, 'pending', :ep, NOW(), NOW())`, ids);
    const social = [
      { slot: 'meet_stylist', label: 'Meet the stylist', task_source: 'goal', completed: false },
      { slot: `deliverable_${ids.d}`, label: 'One reel in the coat', task_source: 'brand_deliverable', owed_to: 'brand', deliverable_id: ids.d, required: true, completed: false },
    ];
    await run(`INSERT INTO episode_todo_lists (id, episode_id, show_id, tasks, social_tasks, status, created_at, updated_at)
               VALUES (:id, :ep, :show, '[]'::jsonb, CAST(:social AS jsonb), 'generated', NOW(), NOW())`,
      { ...ids, id: uuid(), social: JSON.stringify(social) });
    return ids;
  }

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const social = async (ids) => asJson((await q('SELECT social_tasks FROM episode_todo_lists WHERE episode_id = :ep', ids))[0].social_tasks);
  const deliverableTask = async (ids) => (await social(ids)).find((t) => t.deliverable_id === ids.d);

  it('both manual ticks refuse it; submitting it ticks it; a goal still ticks', async () => {
    const ids = await seed();
    const slot = `deliverable_${ids.d}`;
    for (const route of ['complete', 'complete-social']) {
      const res = await auth(request(app).post(`/api/v1/episodes/${ids.ep}/todo/${route}/${slot}`)).send({ completed: true });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DELIVERABLE_COMPLETION_DERIVED');
    }
    expect((await deliverableTask(ids)).completed).toBe(false);
    const [{ status }] = await q('SELECT status FROM event_deliverables WHERE id = :d', ids);
    expect(status).toBe('pending');

    const advance = (to) => auth(request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/deliverables/${ids.d}/status`)).send({ status: to });
    expect((await advance('completed')).status).toBe(200);
    expect((await deliverableTask(ids)).completed).toBe(false);
    expect((await advance('submitted')).status).toBe(200);
    expect(await deliverableTask(ids)).toMatchObject({ completed: true, completed_source: 'deliverable' });

    const goal = await auth(request(app).post(`/api/v1/episodes/${ids.ep}/todo/complete-social/meet_stylist`)).send({ completed: true });
    expect(goal.status).toBe(200);
    expect((await social(ids)).find((t) => t.slot === 'meet_stylist').completed).toBe(true);
  });
});
