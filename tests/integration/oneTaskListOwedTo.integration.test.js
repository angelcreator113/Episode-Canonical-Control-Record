/**
 * T2 (docs/EVENT_EPISODE_FLOW.md §8(bb); Task #2294): one task list, with a
 * source on every item. A deliverable is a host requirement or a brand
 * deliverable by event_deliverables.owed_to (Evoni, 2026-09-29: a new
 * column, set in the Event Package form, backfilled from the event).
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const Sequelize = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { generateEpisodeFromEvent } = require('../../src/services/episodeGeneratorService');
const migration = require('../../src/migrations/20260929190000-add-event-deliverables-owed-to');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('one task list: owed_to and the four sources (T2)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-one-task-list',
      email: 'test@one-task-list.dev',
      name: 'One Task List Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const show of shows) {
      const eps = `(SELECT id FROM episodes WHERE show_id = :show)`;
      for (const t of ['episode_briefs', 'scene_plans', 'episode_todo_lists']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn(`cleanup ${t}:`, err.message));
      }
      await run(`DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show })
        .catch((err) => console.warn('cleanup event_deliverables:', err.message));
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  async function seedShow() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `T2 show ${show.slice(0, 8)}`, slug: `t2-${show.slice(0, 8)}` });
    return show;
  }

  async function seedEvent(show, eventType) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, created_at, updated_at)
               VALUES (:id, :show, :name, :eventType, 'ready', NOW(), NOW())`,
      { id, show, name: `T2 ${eventType}`, eventType });
    return id;
  }

  async function seedDeliverable(eventId, description, owedTo = 'host') {
    const id = uuid();
    await run(`INSERT INTO event_deliverables (id, event_id, description, required, owed_to, status, created_at, updated_at)
               VALUES (:id, :eventId, :description, true, :owedTo, 'pending', NOW(), NOW())`,
      { id, eventId, description, owedTo });
    return id;
  }

  it('the migration backfills brand for a brand_deal event and leaves the rest host', async () => {
    const show = await seedShow();
    const brandEvent = await seedEvent(show, 'brand_deal');
    const inviteEvent = await seedEvent(show, 'invite');
    const brandRow = await seedDeliverable(brandEvent, 'Two sponsored stories');
    const hostRow = await seedDeliverable(inviteEvent, 'Arrive before the toast');

    // up() is idempotent: the column exists, so it re-runs only the backfill.
    await migration.up(sequelize.getQueryInterface(), Sequelize);

    const rows = await q(`SELECT id, owed_to FROM event_deliverables WHERE id IN (:ids)`, { ids: [brandRow, hostRow] });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.owed_to]));
    expect(byId[brandRow]).toBe('brand');
    expect(byId[hostRow]).toBe('host');
  });

  it('the deliverable routes take owed_to, default it to host, and refuse anything else', async () => {
    const show = await seedShow();
    const eventId = await seedEvent(show, 'invite');
    const base = `/api/v1/world/${show}/events/${eventId}/deliverables`;
    const auth = { Authorization: `Bearer ${token}` };

    const plain = await request(app).post(base).set(auth).send({ description: 'Toast the host' });
    expect(plain.status).toBe(201);
    expect(plain.body.deliverable.owed_to).toBe('host');

    const brand = await request(app).post(base).set(auth).send({ description: 'Tag the label', owed_to: 'brand' });
    expect(brand.status).toBe(201);
    expect(brand.body.deliverable.owed_to).toBe('brand');

    const bad = await request(app).post(base).set(auth).send({ description: 'Nope', owed_to: 'sponsor' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/owed_to must be one of host, brand/);

    const moved = await request(app).put(`${base}/${plain.body.deliverable.id}`).set(auth).send({ owed_to: 'brand' });
    expect(moved.status).toBe(200);
    expect(moved.body.deliverable.owed_to).toBe('brand');

    const list = await request(app).get(base).set(auth);
    expect(list.body.deliverables.map((d) => d.owed_to).sort()).toEqual(['brand', 'brand']);
  });

  it('Start Episode writes one list whose every item has a source; host and brand are told apart', async () => {
    const show = await seedShow();
    const eventId = await seedEvent(show, 'invite');
    const hostRow = await seedDeliverable(eventId, 'Arrive before the toast', 'host');
    const brandRow = await seedDeliverable(eventId, 'One reel in the coat', 'brand');

    const [event] = await q(`SELECT * FROM world_events WHERE id = :eventId`, { eventId });
    const result = await generateEpisodeFromEvent(event, models, { showId: show });
    const [todo] = await q(`SELECT social_tasks FROM episode_todo_lists WHERE episode_id = :ep`, { ep: result.episode.id });
    const tasks = typeof todo.social_tasks === 'string' ? JSON.parse(todo.social_tasks) : todo.social_tasks;

    for (const t of tasks) expect(['host_requirement', 'brand_deliverable', 'goal', 'optional']).toContain(t.task_source);
    const byId = Object.fromEntries(tasks.filter((t) => t.deliverable_id).map((t) => [t.deliverable_id, t.task_source]));
    expect(byId).toEqual({ [hostRow]: 'host_requirement', [brandRow]: 'brand_deliverable' });
    expect(tasks.filter((t) => t.required).map((t) => t.deliverable_id).sort()).toEqual([hostRow, brandRow].sort());

    // The Run Sheet and the Career Checklist both read this saved list.
    const res = await request(app).get(`/api/v1/episodes/${result.episode.id}/todo/social`).set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    expect(res.body.social_tasks).toEqual(tasks);
  });
});
