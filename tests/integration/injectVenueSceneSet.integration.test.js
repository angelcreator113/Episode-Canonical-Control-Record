/**
 * F3 (Evoni, 2026-10-01): attaching an event with no scene set chosen.
 * "Use the venue's World Location to list its sets; one is used only when
 * it's the only one, otherwise Evoni chooses; none means no link plus the
 * reconnect prompt." Before, the route matched World Location names loosely
 * from the event's location hint (ILIKE, across every show) and took the
 * first row: never a first match (S3, S7).
 *
 * Each case has a decoy: a set in another show at a World Location whose
 * name contains the event's location hint.
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

(shouldSkip ? describe.skip : describe)('Attaching an event with no scene set chosen: the venue\'s sets (F3)', () => {
  const show = uuid(); const otherShow = uuid();
  const locations = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const inject = (eventId, episodeId) => auth(request(app).post(`/api/v1/world/${show}/events/${eventId}/inject`)).send({ episode_id: episodeId });
  const choose = (eventId, sceneSetId) => auth(request(app).post(`/api/v1/world/${show}/events/${eventId}/scene-set-link`)).send({ scene_set_id: sceneSetId });
  const linksOf = async (ep) => (await rows('SELECT scene_set_id FROM scene_set_episodes WHERE episode_id = :ep AND deleted_at IS NULL', { ep })).map((r) => r.scene_set_id);
  const eventSet = async (event) => (await rows('SELECT scene_set_id FROM world_events WHERE id = :event', { event }))[0].scene_set_id;

  async function location(name) {
    const id = uuid();
    locations.push(id);
    await run(`INSERT INTO world_locations (id, name, created_at, updated_at) VALUES (:id, :name, NOW(), NOW())`, { id, name });
    return id;
  }
  async function sceneSet(name, locationId, showId = show) {
    const id = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, world_location_id, created_at, updated_at)
               VALUES (:id, :name, 'EVENT_LOCATION', :showId, :locationId, NOW(), NOW())`, { id, name, showId, locationId });
    return id;
  }
  /** An episode and an event at `venue` (or none), with a location hint the decoy matches. */
  async function seed(venue) {
    const tag = uuid().slice(0, 8);
    const decoy = await sceneSet(`Decoy ${tag}`, await location(`Glasshouse ${tag} Annex`), otherShow);
    const ep = uuid(); const event = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
               VALUES (:ep, :show, 'Gala', 1, 'draft', '', NOW(), NOW())`, { ep, show });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, venue_location_id, location_hint, created_at, updated_at)
               VALUES (:event, :show, 'Velour Launch', 'invite', 'ready', 5, :venue, :hint, NOW(), NOW())`,
    { event, show, venue, hint: `Glasshouse ${tag}, Echo Park` });
    return { ep, event, decoy };
  }

  beforeAll(async () => {
    await junctionMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-inject-f3', email: 'user@inject-f3.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    for (const id of [show, otherShow]) {
      await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())`,
        { id, name: `F3 ${id.slice(0, 8)}`, slug: `f3-${id.slice(0, 8)}` });
    }
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    const shows = [show, otherShow];
    await sequelize.query('DELETE FROM scene_set_episodes WHERE scene_set_id IN (SELECT id FROM scene_sets WHERE show_id IN (:shows))', { replacements: { shows } });
    await sequelize.query('UPDATE world_events SET scene_set_id = NULL, used_in_episode_id = NULL WHERE show_id IN (:shows)', { replacements: { shows } });
    await sequelize.query('DELETE FROM world_events WHERE show_id IN (:shows)', { replacements: { shows } });
    await sequelize.query('DELETE FROM scene_sets WHERE show_id IN (:shows)', { replacements: { shows } });
    await sequelize.query('DELETE FROM episodes WHERE show_id IN (:shows)', { replacements: { shows } });
    await sequelize.query('DELETE FROM world_locations WHERE id IN (:locations)', { replacements: { locations } });
    await sequelize.query('DELETE FROM shows WHERE id IN (:shows)', { replacements: { shows } });
    await sequelize.close();
  });

  it('the venue\'s only set is used, never a loose name match', async () => {
    const venue = await location('Velour Rooftop');
    const only = await sceneSet('Velour Rooftop', venue);
    const { ep, event } = await seed(venue);

    const res = await inject(event, ep);

    expect(res.body).toMatchObject({ attached: true, scene_set_linked: true, scene_set: { status: 'linked', scene_set_id: only } });
    expect(await linksOf(ep)).toEqual([only]);
    expect(await eventSet(event)).toBe(only);
  });

  it('a venue with several sets: none is taken; Evoni chooses, and the chosen one is linked', async () => {
    const venue = await location('Maison Belle');
    const day = await sceneSet('Maison Belle: Day', venue);
    const night = await sceneSet('Maison Belle: Night', venue);
    const { ep, event } = await seed(venue);

    const res = await inject(event, ep);

    expect(res.body).toMatchObject({ attached: true, scene_set_linked: false, scene_set: { status: 'choose', scene_set_id: null } });
    expect(res.body.scene_set.options.map((o) => o.id)).toEqual([day, night]);
    expect(await linksOf(ep)).toEqual([]);
    expect(await eventSet(event)).toBeNull();

    const chosen = await choose(event, night);
    expect(chosen.body).toMatchObject({ success: true, scene_set: { status: 'linked', scene_set_id: night } });
    expect(await linksOf(ep)).toEqual([night]);
    expect(await eventSet(event)).toBe(night);
  });

  it('a venue with no set, or no venue: no link, and the reconnect prompt', async () => {
    const empty = await location('Empty Hall');
    const a = await seed(empty);
    const noSet = await inject(a.event, a.ep);
    expect(noSet.body).toMatchObject({ attached: true, scene_set: { status: 'needs_reconnecting', scene_set_id: null, options: [] } });
    expect(noSet.body.scene_set.reason).toMatch(/no scene set yet/);
    expect(await linksOf(a.ep)).toEqual([]);

    const b = await seed(null);
    const noVenue = await inject(b.event, b.ep);
    expect(noVenue.body).toMatchObject({ attached: true, scene_set: { status: 'needs_reconnecting', scene_set_id: null } });
    expect(noVenue.body.scene_set.reason).toMatch(/no venue World Location/);
    expect(await linksOf(b.ep)).toEqual([]);
    expect(await eventSet(b.event)).toBeNull();
  });

  it('a chosen set that does not exist is not linked, and the event keeps none', async () => {
    const venue = await location('Twin Hall');
    await sceneSet('Twin Hall A', venue);
    await sceneSet('Twin Hall B', venue);
    const { ep, event } = await seed(venue);
    await inject(event, ep);

    const res = await choose(event, uuid());

    expect(res.body.scene_set.status).toBe('needs_reconnecting');
    expect(await eventSet(event)).toBeNull();
    expect(await linksOf(ep)).toEqual([]);
  });
});
