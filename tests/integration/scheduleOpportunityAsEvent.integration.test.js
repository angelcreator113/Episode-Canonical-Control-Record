/**
 * "Schedule as Event" accepts nothing (Evoni's ruling: an opportunity is
 * accepted only by an explicit decision; the Spring Capsule offer became
 * booked this way though Lala never answered). POST
 * /feed-pipeline/:showId/schedule/:id links the event and notes it in the
 * opportunity's history, and leaves its status as it was; a closed one is
 * refused; the event and the link are one transaction. On the test database.
 * No model calls: no ANTHROPIC_API_KEY and no connector, so the venue falls
 * back to the pool and no draft or guest selection runs.
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
const TAG = uuid().slice(0, 8);
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Schedule as Event keeps the status', () => {
  const show = uuid();
  let token;
  let savedKey;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const schedule = (id) => auth(request(app).post(`/api/v1/feed-pipeline/${show}/schedule/${id}`));
  const makeOpp = async (name, status, extra = {}) => {
    const id = uuid();
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, status_history, deliverables, created_at, updated_at)
      VALUES (:id, :show, :name, 'campaign', :status, CAST(:history AS jsonb), CAST(:deliverables AS jsonb), NOW(), NOW())`,
    { id, show, name: `${name} ${TAG}`, status, history: JSON.stringify([{ status, date: new Date().toISOString(), note: 'seeded' }]), deliverables: JSON.stringify(extra.deliverables || []) });
    return id;
  };
  const row = async (id) => (await rows('SELECT status, event_id, status_history FROM opportunities WHERE id = :id', { id }))[0];
  const eventsNamed = (name) => rows('SELECT id, deleted_at FROM world_events WHERE show_id = :show AND name = :name', { show, name: `${name} ${TAG}` });

  beforeAll(async () => {
    savedKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    token = TokenService.generateTokenPair({ id: 'test-schedule-keeps', email: 'admin@schedule.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST('{}' AS jsonb), NOW(), NOW())`,
      { show, name: `Schedule ${TAG}`, slug: `schedule-${TAG}` });
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey;
    await run('DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)', { show });
    // world_events.opportunity_id references opportunities: events first.
    await run('DELETE FROM world_events WHERE show_id = :show', { show });
    await run('DELETE FROM opportunities WHERE show_id = :show', { show });
    await run('DELETE FROM shows WHERE id = :show', { show });
    await sequelize.close();
  });

  test("an offered one links the event and stays offered, with a history entry", async () => {
    const id = await makeOpp('Spring Capsule', 'offered', { deliverables: [{ description: 'Two stories', completed: false }] });
    const res = await schedule(id);
    expect(res.status).toBe(200);
    const eventId = res.body.data.event_id;
    expect(res.body.data.opportunity).toMatchObject({ status: 'offered', event_id: eventId });
    expect(res.body.data.deliverables).toBe(1);
    const after = await row(id);
    expect(after).toMatchObject({ status: 'offered', event_id: eventId });
    expect(after.status_history).toHaveLength(2);
    expect(after.status_history[1]).toMatchObject({ status: 'offered', note: 'Scheduled as event; status unchanged', event_id: eventId });
    const [event] = await rows('SELECT opportunity_id, deleted_at FROM world_events WHERE id = :eventId', { eventId });
    expect(event).toEqual({ opportunity_id: id, deleted_at: null });
    const [{ n }] = await rows('SELECT COUNT(*)::int AS n FROM event_deliverables WHERE event_id = :eventId', { eventId });
    expect(n).toBe(1);
    // A second schedule is refused: it already has an event.
    const again = await schedule(id);
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('This opportunity already has an event scheduled');
  });

  test('a preparing one stays preparing (it no longer moves back to booked)', async () => {
    const id = await makeOpp('Preparing Shoot', 'preparing');
    const res = await schedule(id);
    expect(res.status).toBe(200);
    expect(await row(id)).toMatchObject({ status: 'preparing', event_id: res.body.data.event_id });
  });

  test('a declined one is refused with a 409, and no event is made', async () => {
    const id = await makeOpp('Declined Gala', 'declined');
    const res = await schedule(id);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('This opportunity is declined; a closed opportunity cannot be scheduled as an event.');
    expect(await row(id)).toMatchObject({ status: 'declined', event_id: null });
    expect(await eventsNamed('Declined Gala')).toEqual([]);
  });

  test('a failure after the event insert leaves no event behind (one transaction)', async () => {
    const id = await makeOpp('Rollback Party', 'considering', { deliverables: [{ description: 'One post', completed: false }] });
    const realQuery = sequelize.query.bind(sequelize);
    const spy = jest.spyOn(sequelize, 'query').mockImplementation((sql, ...rest) => {
      if (typeof sql === 'string' && /UPDATE opportunities SET event_id/.test(sql)) return Promise.reject(new Error('boom'));
      return realQuery(sql, ...rest);
    });
    let res;
    try {
      res = await schedule(id);
    } finally {
      spy.mockRestore();
    }
    expect(res.status).toBe(500);
    expect(await row(id)).toMatchObject({ status: 'considering', event_id: null });
    expect(await eventsNamed('Rollback Party')).toEqual([]);
    const [{ n }] = await rows(`SELECT COUNT(*)::int AS n FROM event_deliverables d WHERE NOT EXISTS (SELECT 1 FROM world_events e WHERE e.id = d.event_id)`);
    expect(n).toBe(0);
    // It can be scheduled once the failure is gone, and stays considering.
    const retry = await schedule(id);
    expect(retry.status).toBe(200);
    expect(await row(id)).toMatchObject({ status: 'considering', event_id: retry.body.data.event_id });
  });
});
