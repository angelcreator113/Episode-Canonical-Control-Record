/**
 * F2 (Evoni, 2026-10-01): attaching an event to an episode (POST
 * /world/:showId/events/:eventId/inject). "The required links commit
 * together or not at all; if the scene-set link can't be made, the UI shows
 * "Event attached · Scene set needs reconnecting" with a Retry." On main the
 * script was saved before the event's link, each in its own statement, and a
 * failed scene-set link still returned success with scene_set_linked false.
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const junctionMigration = require('../../src/migrations/20260324000000-add-scene-sets-cover-and-episodes');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Attaching an event: required links together, the scene set reconnectable (F2)', () => {
  const show = uuid();
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const inject = (eventId, episodeId) => auth(request(app).post(`/api/v1/world/${show}/events/${eventId}/inject`)).send({ episode_id: episodeId });
  const retry = (eventId) => auth(request(app).post(`/api/v1/world/${show}/events/${eventId}/scene-set-link`)).send({});
  const linked = async (setId, ep) => (await rows(
    'SELECT 1 FROM scene_set_episodes WHERE scene_set_id = :setId AND episode_id = :ep AND deleted_at IS NULL', { setId, ep })).length > 0;

  async function seed({ setDeleted = false } = {}) {
    const ep = uuid(); const setId = uuid(); const event = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
               VALUES (:ep, :show, 'Gala', 1, 'draft', '## BEAT: STAKES\nLala arrives.', NOW(), NOW())`, { ep, show });
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, created_at, updated_at, deleted_at)
               VALUES (:setId, 'The Glasshouse', 'EVENT_LOCATION', :show, NOW(), NOW(), ${setDeleted ? 'NOW()' : 'NULL'})`, { setId, show });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, scene_set_id, created_at, updated_at)
               VALUES (:event, :show, 'Velour Launch', 'invite', 'ready', 5, :setId, NOW(), NOW())`, { event, show, setId });
    return { ep, setId, event };
  }

  beforeAll(async () => {
    await junctionMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-inject-f2', email: 'user@inject-f2.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `F2 ${show.slice(0, 8)}`, slug: `f2-${show.slice(0, 8)}` });
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await run('DELETE FROM scene_set_episodes WHERE scene_set_id IN (SELECT id FROM scene_sets WHERE show_id = :show)', { show });
    await run('UPDATE world_events SET scene_set_id = NULL, used_in_episode_id = NULL WHERE show_id = :show', { show });
    await run('DELETE FROM world_events WHERE show_id = :show', { show });
    await run('DELETE FROM scene_sets WHERE show_id = :show', { show });
    await run('DELETE FROM episodes WHERE show_id = :show', { show });
    await run('DELETE FROM shows WHERE id = :show', { show });
    await sequelize.close();
  });

  it('attaches the event and links its scene set', async () => {
    const { ep, setId, event } = await seed();

    const res = await inject(event, ep);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, attached: true, scene_set_linked: true, scene_set: { status: 'linked', scene_set_id: setId } });
    expect(await linked(setId, ep)).toBe(true);
  });

  it('a scene-set link that fails: the event is attached, and the response says it needs reconnecting; Retry links it', async () => {
    const { ep, setId, event } = await seed();
    // A real database failure inside the attach: without its unique index the
    // link's ON CONFLICT is refused.
    await run('DROP INDEX IF EXISTS scene_set_episodes_unique_pair');
    let res;
    try {
      res = await inject(event, ep);
    } finally {
      await run(`CREATE UNIQUE INDEX IF NOT EXISTS scene_set_episodes_unique_pair
                 ON scene_set_episodes (scene_set_id, episode_id) WHERE deleted_at IS NULL`);
    }

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, attached: true, scene_set_linked: false, scene_set: { status: 'needs_reconnecting', scene_set_id: setId } });
    expect(res.body.scene_set.reason).toMatch(/could not be linked/);
    // The required links committed.
    const [e] = await rows('SELECT used_in_episode_id, status FROM world_events WHERE id = :event', { event });
    expect(e).toEqual({ used_in_episode_id: ep, status: 'used' });
    const [episode] = await rows('SELECT script_content FROM episodes WHERE id = :ep', { ep });
    expect(episode.script_content).toContain('[EVENT: name="Velour Launch"');
    expect(await linked(setId, ep)).toBe(false);

    const again = await retry(event);
    expect(again.body).toMatchObject({ success: true, episode_id: ep, scene_set: { status: 'linked', scene_set_id: setId } });
    expect(await linked(setId, ep)).toBe(true);
  });

  it('a required link that fails: nothing is committed', async () => {
    const { ep, event } = await seed();
    const realQuery = sequelize.query.bind(sequelize);
    jest.spyOn(sequelize, 'query').mockImplementation((sql, ...rest) => {
      if (typeof sql === 'string' && /SET used_in_episode_id = :episodeId/.test(sql)) return Promise.reject(new Error('event link refused'));
      return realQuery(sql, ...rest);
    });

    const res = await inject(event, ep);

    jest.restoreAllMocks();
    expect(res.status).toBe(500);
    const [episode] = await rows('SELECT script_content FROM episodes WHERE id = :ep', { ep });
    expect(episode.script_content).toBe('## BEAT: STAKES\nLala arrives.');
    const [e] = await rows('SELECT used_in_episode_id FROM world_events WHERE id = :event', { event });
    expect(e.used_in_episode_id).toBeNull();
  });

  it('an event whose scene set was deleted is attached, and its scene set needs reconnecting', async () => {
    const { ep, setId, event } = await seed({ setDeleted: true });

    const res = await inject(event, ep);

    expect(res.body).toMatchObject({ attached: true, scene_set_linked: false, scene_set: { status: 'needs_reconnecting', scene_set_id: setId } });
    expect(await linked(setId, ep)).toBe(false);
  });

  it('Retry on an event that is not attached is refused', async () => {
    const { event } = await seed();
    const res = await retry(event);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EVENT_NOT_ATTACHED');
  });
});
