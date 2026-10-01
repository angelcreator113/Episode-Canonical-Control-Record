/**
 * Ruling S5 (Evoni, 2026-09-30; EVENT_EPISODE_FLOW.md §8(dd)): "Venue
 * generation saves the full brief and the world_location_id, and never
 * overwrites a location's style guide." Through POST
 * /world/:showId/events/:eventId/venue-brief and generate-venue on the test
 * database: the venue's interior and exterior come from Scene Briefs for the
 * event at its venue World Location, shown first with their estimate (S2);
 * the scene set keeps the World Location and the briefs; the location's
 * style guide is left as it was. The image provider and S3 are mocked.
 */
jest.unmock('uuid');

jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn(), create: jest.requireActual('axios').create }));

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })),
    PutObjectCommand: jest.fn((input) => ({ input })),
    DeleteObjectCommand: jest.fn((input) => ({ input })),
  };
});

const request = require('supertest');
const axios = require('axios');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { briefToPrompt } = require('../../src/services/sceneBriefService');
const { EXTERIOR_CAMERA } = require('../../src/services/venueGenerationService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

const GUIDE = { architecture: 'Victorian iron-and-glass conservatory', materials: { metal: 'black wrought iron' }, palette: ['white', 'black'] };

(shouldSkip ? describe.skip : describe)('Venue generation from the Scene Brief (S5)', () => {
  let token;
  const ids = { show: uuid(), location: uuid(), event: uuid(), noVenueEvent: uuid() };
  const saved = {};

  beforeAll(async () => {
    await sequelize.query(`ALTER TABLE scene_sets
      ADD COLUMN IF NOT EXISTS style_reference_url text,
      ADD COLUMN IF NOT EXISTS negative_prompt text,
      ADD COLUMN IF NOT EXISTS variation_count integer DEFAULT 1,
      ADD COLUMN IF NOT EXISTS cover_angle_id uuid,
      ADD COLUMN IF NOT EXISTS base_generation jsonb,
      ADD COLUMN IF NOT EXISTS base_model varchar(40)`);
    await sequelize.query(`ALTER TABLE scene_angles
      ADD COLUMN IF NOT EXISTS angle_description text,
      ADD COLUMN IF NOT EXISTS camera_direction text,
      ADD COLUMN IF NOT EXISTS quality_score integer,
      ADD COLUMN IF NOT EXISTS artifact_flags jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS quality_review jsonb,
      ADD COLUMN IF NOT EXISTS generation_attempt integer,
      ADD COLUMN IF NOT EXISTS refined_prompt text,
      ADD COLUMN IF NOT EXISTS camera_motion varchar(255),
      ADD COLUMN IF NOT EXISTS video_duration integer,
      ADD COLUMN IF NOT EXISTS style_reference_url text,
      ADD COLUMN IF NOT EXISTS variation_count integer,
      ADD COLUMN IF NOT EXISTS variation_data jsonb,
      ADD COLUMN IF NOT EXISTS post_processing_status text,
      ADD COLUMN IF NOT EXISTS enhanced_still_url text,
      ADD COLUMN IF NOT EXISTS enhanced_video_url text`);
    token = TokenService.generateTokenPair({
      id: 'test-user-venue-brief-s5', email: 'user@venue-brief-s5.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `S5 show ${ids.show.slice(0, 8)}`, slug: `s5-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_locations (id, name, description, city, district, venue_type, style_guide, created_at, updated_at)
               VALUES (:location, 'The Glasshouse', 'A greenhouse ballroom under a glass roof.', 'Echo Park', 'Sunset Steps', 'event_hall', :guide, NOW(), NOW())`,
    { location: ids.location, guide: JSON.stringify(GUIDE) });
    // The venue named both on the event and in its automation copy, which is
    // where the old code took the location whose style guide it replaced.
    await run(`INSERT INTO world_events (id, show_id, name, event_type, theme, format, event_time, prestige, status,
                 venue_location_id, venue_name, canon_consequences, created_at, updated_at)
               VALUES (:event, :show, 'Velour Launch', 'invite', 'Midnight Garden', 'brand_launch', '20:00', 5, 'ready',
                 :location, 'The Glasshouse', :cc, NOW(), NOW())`,
    { ...ids, cc: JSON.stringify({ automation: { venue_location_id: ids.location, venue_name: 'The Glasshouse' } }) });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, prestige, status, venue_name, created_at, updated_at)
               VALUES (:noVenueEvent, :show, 'Pop-up Night', 'invite', 5, 'ready', 'Somewhere', NOW(), NOW())`, ids);
  });

  beforeEach(() => {
    for (const k of ['FAL_KEY', 'S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET', 'AI_DAILY_IMAGE_BUDGET_USD', 'AI_DAILY_BUDGET_USD']) saved[k] = process.env[k];
    process.env.FAL_KEY = 'test-fal';
    process.env.AI_DAILY_IMAGE_BUDGET_USD = '100000';
    process.env.AI_DAILY_BUDGET_USD = '100000';
    axios.post.mockReset();
    axios.get.mockReset();
    axios.get.mockImplementation(async () => ({ data: Buffer.from('jpg') }));
    axios.post.mockImplementation(async (url) => {
      if (url.startsWith('https://fal.run/')) return { status: 200, data: { images: [{ url: `https://fal.media/${axios.post.mock.calls.length}.jpg` }] } };
      throw new Error(`unexpected provider call ${url}`);
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    const [sets] = await run('SELECT id FROM scene_sets WHERE show_id = :show', ids);
    const setIds = sets.map((r) => r.id);
    if (setIds.length) {
      await sequelize.query('DELETE FROM scene_angles WHERE scene_set_id IN (:setIds)', { replacements: { setIds } });
      await sequelize.query('DELETE FROM scene_sets WHERE id IN (:setIds)', { replacements: { setIds } });
    }
    await run('DELETE FROM world_events WHERE id IN (:event, :noVenueEvent)', ids);
    await run('DELETE FROM world_locations WHERE id = :location', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const venueBrief = (eventId, body = {}) => auth(request(app).post(`/api/v1/world/${ids.show}/events/${eventId}/venue-brief`)).send(body);
  const generate = (eventId, body = {}) => auth(request(app).post(`/api/v1/world/${ids.show}/events/${eventId}/generate-venue`)).send(body);
  const line = (b, key) => b.lines.find((l) => l.key === key);

  it('the venue brief: the event at its venue World Location, interior and exterior, the estimate; nothing generated', async () => {
    const res = await venueBrief(ids.event);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.target).toMatchObject({ kind: 'venue', event_id: ids.event, scene_set_name: 'The Glasshouse', world_location_id: ids.location });
    expect(d.brief.world_location_id).toBe(ids.location);
    expect(d.brief.event_id).toBe(ids.event);
    expect(line(d.brief, 'architecture')).toMatchObject({ source: 'venue', text: 'Architecture: Victorian iron-and-glass conservatory.' });
    expect(line(d.brief, 'description').text).toBe('A greenhouse ballroom under a glass roof.');
    expect(line(d.brief, 'concept').text).toMatch(/^Dressed for Velour Launch/);
    expect(d.brief.missing).toEqual([]);
    expect(line(d.exterior_brief, 'camera').text).toBe(EXTERIOR_CAMERA);
    expect(d.prompt).toBe(briefToPrompt(d.brief));
    expect(d.estimate).toMatchObject({ images: 2, priced: true });
    expect(typeof d.estimate.usd).toBe('number');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('an event with no venue World Location: the brief flags it', async () => {
    const d = (await venueBrief(ids.noVenueEvent)).body.data;
    expect(d.brief.world_location_id).toBeNull();
    expect(d.brief.missing).toEqual(expect.arrayContaining([{ layer: 'place', key: 'world_location', label: 'World Location' }]));
  });

  it('generate-venue saves the World Location and the full briefs, sends the confirmed overrides, and leaves the style guide', async () => {
    const res = await generate(ids.event, { force: true, overrides: { materials: 'Brass and frosted glass' } });
    expect(res.status).toBe(200);
    const setId = res.body.data.scene_set_id;
    expect(setId).toBeTruthy();

    const set = await models.SceneSet.findByPk(setId);
    expect(set.world_location_id).toBe(ids.location);
    expect(set.base_generation.brief).toMatchObject({ scene_set_id: setId, world_location_id: ids.location, event_id: ids.event });
    expect(line(set.base_generation.brief, 'materials')).toMatchObject({ source: 'override', text: 'Brass and frosted glass.' });
    expect(set.base_generation.exterior_brief).toMatchObject({ scene_set_id: setId, angle: 'ESTABLISHING' });
    expect(set.base_runway_prompt).toBe(briefToPrompt(set.base_generation.brief));

    // The prompts the provider was sent are the briefs' prompts.
    const sent = axios.post.mock.calls.filter(([u]) => u.startsWith('https://fal.run/')).map(([, body]) => body.prompt);
    expect(sent).toEqual([briefToPrompt(set.base_generation.brief), briefToPrompt(set.base_generation.exterior_brief)]);

    const angles = await models.SceneAngle.findAll({ where: { scene_set_id: setId }, order: [['sort_order', 'ASC']] });
    expect(angles.map((a) => a.angle_label)).toEqual(['ESTABLISHING', 'interior_wide']);
    expect(angles[0].runway_prompt).toBe(briefToPrompt(set.base_generation.exterior_brief));

    const [[loc]] = await run('SELECT style_guide FROM world_locations WHERE id = :location', ids);
    const guide = typeof loc.style_guide === 'string' ? JSON.parse(loc.style_guide) : loc.style_guide;
    expect(guide).toEqual(GUIDE);

    const [[ev]] = await run('SELECT scene_set_id FROM world_events WHERE id = :event', ids);
    expect(ev.scene_set_id).toBe(setId);
  });

  it('bad overrides are refused before anything is generated; an unknown event is 404', async () => {
    expect((await venueBrief(ids.event, { overrides: ['x'] })).status).toBe(400);
    expect((await generate(ids.event, { force: true, overrides: 'x' })).status).toBe(400);
    expect(axios.post).not.toHaveBeenCalled();
    expect((await venueBrief(uuid())).status).toBe(404);
    expect((await request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/venue-brief`).send({})).status).toBe(401);
  });
});
