/**
 * "Generate this look", L7-L9 (Evoni, 2026-10-02, answers 1-4 and 6;
 * docs/EVENT_EPISODE_FLOW.md §8(hh)), on the migrated database through
 * the real routes. The paid image calls are stubbed.
 * - The set: the event's own; else the venue's only set; several ask to
 *   choose; none, one is created for the venue and linked (answer 3).
 * - No approved base: the empty-room base only, no event dressing; a base
 *   waiting for approval generates nothing (L8, answer 4).
 * - An approved base: the event's look, a Kontext edit of it, stored as
 *   that event's look; the set's base is never touched, the approved set
 *   included (answers 1, 2).
 * - Scene Sets lists each set's looks, naming their events (L9).
 */
jest.unmock('uuid');

process.env.FAL_KEY = process.env.FAL_KEY || 'test-fal-key';

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const sceneGen = require('../../src/services/sceneGenerationService');
const modelComparison = require('../../src/services/sceneModelComparisonService');
const looksMigration = require('../../src/migrations/20261002130000-create-scene-set-looks');
const approvedMigration = require('../../src/migrations/20261001220000-world-locations-approved-base');
const venueLookMigration = require('../../src/migrations/20261002110000-add-world-events-venue-look');

const { Sequelize } = require('sequelize');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Generate this look (§8(hh) L7-L9)', () => {
  const show = uuid();
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const url = (eventId, tail = '') => `/api/v1/world/${show}/events/${eventId}/look${tail}`;

  async function location({ approvedSet = null, approvedUrl = null } = {}) {
    const id = uuid();
    await run(`INSERT INTO world_locations (id, name, description, approved_base_scene_set_id, approved_base_image_url, created_at, updated_at)
               VALUES (:id, 'The Glasshouse', 'A glass conservatory.', :approvedSet, :approvedUrl, NOW(), NOW())`,
    { id, approvedSet, approvedUrl });
    return id;
  }
  async function sceneSet(locationId, { name = 'Glasshouse Hall', base = null } = {}) {
    const id = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, world_location_id, base_still_url, generation_status, created_at, updated_at)
               VALUES (:id, :name, 'EVENT_LOCATION', :show, :locationId, :base, 'complete', NOW(), NOW())`,
    { id, name, show, locationId, base });
    return id;
  }
  async function event(locationId, sceneSetId = null, name = 'Velour Gala') {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, venue_location_id, venue_name, scene_set_id, venue_look, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', 'ready', 6, :locationId, 'The Glasshouse', :sceneSetId,
                       CAST(:look AS jsonb), NOW(), NOW())`,
    { id, show, name, locationId, sceneSetId, look: JSON.stringify({ overall: 'Candlelit gala in ivory and gold.', decor: 'White orchids.' }) });
    return id;
  }
  const flush = () => new Promise((r) => setImmediate(r));

  beforeAll(async () => {
    const qi = sequelize.getQueryInterface();
    for (const m of [approvedMigration, venueLookMigration, looksMigration]) await m.up(qi, Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-looks', email: 'user@looks.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, '{}', NOW(), NOW())`,
      { id: show, name: `Looks ${show.slice(0, 8)}`, slug: `looks-${show.slice(0, 8)}` });
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(modelComparison, 'missingProviderKeys').mockReturnValue([]);
  });
  afterEach(() => jest.restoreAllMocks());

  it('the migration is re-runnable and creates scene_set_looks', async () => {
    await looksMigration.up(sequelize.getQueryInterface(), Sequelize);
    const cols = await rows(`SELECT column_name FROM information_schema.columns WHERE table_name = 'scene_set_looks' ORDER BY column_name`);
    expect(cols.map((c) => c.column_name)).toEqual(expect.arrayContaining(['scene_set_id', 'event_id', 'status', 'image_url', 'brief', 'cost_usd', 'deleted_at']));
  });

  it('no set and no approved base: the brief offers the empty-room base for a new set; generating makes the set, links it, and makes only the base', async () => {
    const loc = await location();
    const ev = await event(loc);
    const brief = await auth(request(app).post(url(ev, '/brief'))).send({});
    expect(brief.status).toBe(200);
    expect(brief.body.data).toMatchObject({ step: 'base', scene_set: null, creates_set: { name: 'The Glasshouse' } });
    expect(brief.body.data.brief.event_id).toBeNull();
    expect(brief.body.data.brief.lines.some((l) => l.layer === 'event')).toBe(false);
    expect(brief.body.data.estimate).toHaveProperty('usd');
    expect(await rows('SELECT id FROM scene_sets WHERE world_location_id = :loc', { loc })).toHaveLength(0);

    const base = jest.spyOn(sceneGen, 'generateBaseScene').mockResolvedValue({});
    const res = await auth(request(app).post(url(ev, '/generate'))).send({});
    expect(res.status).toBe(202);
    expect(res.body.data.step).toBe('base');
    await flush();
    const [created] = await rows('SELECT id, show_id FROM scene_sets WHERE world_location_id = :loc AND deleted_at IS NULL', { loc });
    expect(created).toMatchObject({ id: res.body.data.scene_set_id, show_id: show });
    expect((await rows('SELECT scene_set_id FROM world_events WHERE id = :ev', { ev }))[0].scene_set_id).toBe(created.id);
    expect(base).toHaveBeenCalledTimes(1);
    expect(base.mock.calls[0][2]).toEqual({ eventId: null, overrides: {} });
    expect(await rows('SELECT id FROM scene_set_looks WHERE event_id = :ev', { ev })).toHaveLength(0);
  });

  it('a base waiting for approval: nothing is generated', async () => {
    const loc = await location();
    const set = await sceneSet(loc, { base: 'https://x/base.jpg' });
    const ev = await event(loc, set);
    const base = jest.spyOn(sceneGen, 'generateBaseScene');
    const dressed = jest.spyOn(sceneGen, 'generateDressedStill');
    expect((await auth(request(app).post(url(ev, '/brief'))).send({})).body.data.step).toBe('awaiting_approval');
    const res = await auth(request(app).post(url(ev, '/generate'))).send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ step: 'awaiting_approval', scene_set_id: set });
    expect(base).not.toHaveBeenCalled();
    expect(dressed).not.toHaveBeenCalled();
  });

  it('an approved base: the look is a Kontext edit of it on the approved set itself, stored as the event\'s look; the base is untouched', async () => {
    const setId = uuid();
    const loc = await location({ approvedSet: setId, approvedUrl: 'https://x/approved.jpg' });
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, world_location_id, base_still_url, generation_status, created_at, updated_at)
               VALUES (:setId, 'Glasshouse Hall', 'EVENT_LOCATION', :show, :loc, 'https://x/approved.jpg', 'complete', NOW(), NOW())`, { setId, show, loc });
    const ev = await event(loc, setId);

    const brief = await auth(request(app).post(url(ev, '/brief'))).send({});
    expect(brief.body.data.step).toBe('look');
    expect(brief.body.data.brief.mode).toBe('event_dressing');
    expect(brief.body.data.brief.approved_base.image_url).toBe('https://x/approved.jpg');
    expect(brief.body.data.estimate.base_model).toBe('flux-kontext');

    const dressed = jest.spyOn(sceneGen, 'generateDressedStill').mockResolvedValue({ stillUrl: 'https://x/look-1.jpg', cost: 0.04 });
    const res = await auth(request(app).post(url(ev, '/generate'))).send({});
    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({ step: 'look', scene_set_id: setId });
    await flush();
    expect(dressed).toHaveBeenCalledTimes(1);
    const [, prompt, source, opts] = dressed.mock.calls[0];
    expect(source).toBe('https://x/approved.jpg');
    expect(prompt).toContain('Candlelit gala in ivory and gold');
    expect(opts).toEqual({ suffix: `look-${ev}` });

    const [look] = await rows('SELECT status, image_url, cost_usd FROM scene_set_looks WHERE scene_set_id = :setId AND event_id = :ev', { setId, ev });
    expect(look).toMatchObject({ status: 'complete', image_url: 'https://x/look-1.jpg' });
    expect(Number(look.cost_usd)).toBeCloseTo(0.04);
    expect((await rows('SELECT base_still_url FROM scene_sets WHERE id = :setId', { setId }))[0].base_still_url).toBe('https://x/approved.jpg');

    const got = await auth(request(app).get(url(ev)));
    expect(got.body.data).toMatchObject({
      scene_set: { id: setId, name: 'Glasshouse Hall' },
      approved_base: { scene_set_id: setId, image_url: 'https://x/approved.jpg' },
      look: { status: 'complete', image_url: 'https://x/look-1.jpg' },
    });

    // A second event keeps its own look; regenerating the first replaces only its own.
    const ev2 = await event(loc, setId, 'Garden Brunch');
    dressed.mockResolvedValueOnce({ stillUrl: 'https://x/look-2.jpg', cost: 0.04 });
    await auth(request(app).post(url(ev2, '/generate'))).send({});
    await flush();
    dressed.mockResolvedValueOnce({ stillUrl: 'https://x/look-1b.jpg', cost: 0.04 });
    await auth(request(app).post(url(ev, '/generate'))).send({});
    await flush();
    const looks = await rows('SELECT event_id, image_url FROM scene_set_looks WHERE scene_set_id = :setId AND deleted_at IS NULL ORDER BY image_url', { setId });
    expect(looks).toEqual([{ event_id: ev, image_url: 'https://x/look-1b.jpg' }, { event_id: ev2, image_url: 'https://x/look-2.jpg' }]);

    // L9: Scene Sets lists the set's looks, each naming its event.
    const list = await auth(request(app).get(`/api/v1/scene-sets?show_id=${show}`));
    const listed = list.body.data.find((s) => s.id === setId);
    expect(listed.looks.map((l) => l.event_name).sort()).toEqual(['Garden Brunch', 'Velour Gala']);
    expect(listed.base_approved).toBe(true);
  });

  it('a failed look is marked failed with its reason', async () => {
    const setId = uuid();
    const loc = await location({ approvedSet: setId, approvedUrl: 'https://x/approved.jpg' });
    await sceneSet(loc, { name: 'Other hall' });
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, world_location_id, base_still_url, generation_status, created_at, updated_at)
               VALUES (:setId, 'Hall', 'EVENT_LOCATION', :show, :loc, 'https://x/approved.jpg', 'complete', NOW(), NOW())`, { setId, show, loc });
    const ev = await event(loc, setId);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(sceneGen, 'generateDressedStill').mockRejectedValue(new Error('provider down'));
    await auth(request(app).post(url(ev, '/generate'))).send({});
    await flush();
    const [look] = await rows('SELECT status, error, image_url FROM scene_set_looks WHERE event_id = :ev', { ev });
    expect(look).toEqual({ status: 'failed', error: 'provider down', image_url: null });
  });

  it('several sets at the venue: the brief asks to choose; generating refuses until one is chosen, then links it', async () => {
    const loc = await location();
    const a = await sceneSet(loc, { name: 'Atrium' });
    await sceneSet(loc, { name: 'Bar' });
    const ev = await event(loc);
    const brief = await auth(request(app).post(url(ev, '/brief'))).send({});
    expect(brief.body.data.step).toBe('choose');
    expect(brief.body.data.options.map((o) => o.name)).toEqual(['Atrium', 'Bar']);
    const refused = await auth(request(app).post(url(ev, '/generate'))).send({});
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('CHOOSE_SET');
    expect(refused.body.options).toHaveLength(2);

    jest.spyOn(sceneGen, 'generateBaseScene').mockResolvedValue({});
    const chosen = await auth(request(app).post(url(ev, '/generate'))).send({ scene_set_id: a });
    expect(chosen.status).toBe(202);
    expect((await rows('SELECT scene_set_id FROM world_events WHERE id = :ev', { ev }))[0].scene_set_id).toBe(a);

    const stranger = await sceneSet(await location(), { name: 'Elsewhere' });
    const ev2 = await event(loc);
    const bad = await auth(request(app).post(url(ev2, '/brief'))).send({ scene_set_id: stranger });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('SET_NOT_AT_VENUE');
  });

  it('the venue\'s only set is used and linked', async () => {
    const loc = await location();
    const only = await sceneSet(loc, { name: 'Only hall' });
    const ev = await event(loc);
    const brief = await auth(request(app).post(url(ev, '/brief'))).send({});
    expect(brief.body.data).toMatchObject({ step: 'base', scene_set: { id: only } });
    jest.spyOn(sceneGen, 'generateBaseScene').mockResolvedValue({});
    await auth(request(app).post(url(ev, '/generate'))).send({});
    expect((await rows('SELECT scene_set_id FROM world_events WHERE id = :ev', { ev }))[0].scene_set_id).toBe(only);
  });
});
