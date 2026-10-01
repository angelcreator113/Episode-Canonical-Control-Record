/**
 * F1 (Evoni, 2026-10-01): "Generate Venue Images" on an event whose scene set
 * has no base image skipped, as the event already had a scene set. Now an
 * attached set is kept: its missing base is generated for this event, after
 * its Scene Brief and estimate are shown (S2), and the outcome is reported
 * honestly: generated, already available, or failed. A set that no longer
 * exists reads as none. The image provider and S3 are mocked.
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
const sharp = require('sharp');
const axios = require('axios');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { briefToPrompt } = require('../../src/services/sceneBriefService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

const GUIDE = { architecture: 'Victorian iron-and-glass conservatory', materials: { metal: 'black wrought iron' }, palette: ['white', 'black'] };

(shouldSkip ? describe.skip : describe)('Venue images for an event with a scene set attached (F1)', () => {
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
      id: 'test-user-venue-attached-f1', email: 'user@venue-attached-f1.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `F1 show ${ids.show.slice(0, 8)}`, slug: `f1-${ids.show.slice(0, 8)}` });
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

  let PNG;
  beforeAll(async () => {
    PNG = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#ffffff' } }).png().toBuffer();
  });

  beforeEach(() => {
    for (const k of ['FAL_KEY', 'S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET', 'AI_DAILY_IMAGE_BUDGET_USD', 'AI_DAILY_BUDGET_USD']) saved[k] = process.env[k];
    process.env.FAL_KEY = 'test-fal';
    process.env.AI_DAILY_IMAGE_BUDGET_USD = '100000';
    process.env.AI_DAILY_BUDGET_USD = '100000';
    axios.post.mockReset();
    axios.get.mockReset();
    // A real (tiny) image: the base path stores it through sharp.
    axios.get.mockImplementation(async () => ({ data: PNG }));
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
  const falCalls = () => axios.post.mock.calls.filter(([u]) => u.startsWith('https://fal.run/'));
  const eventSet = async () => (await run('SELECT scene_set_id FROM world_events WHERE id = :event', ids))[0][0].scene_set_id;
  async function attachSet({ base = null, deleted = false } = {}) {
    const id = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, world_location_id, base_still_url, created_at, updated_at, deleted_at)
               VALUES (:id, 'The Glasshouse', 'EVENT_LOCATION', :show, :location, :base, NOW(), NOW(), ${deleted ? 'NOW()' : 'NULL'})`,
    { id, show: ids.show, location: ids.location, base });
    await run('UPDATE world_events SET scene_set_id = :id WHERE id = :event', { id, event: ids.event });
    return id;
  }

  it('an attached set with no image: its brief and estimate are shown, then its base is generated for this event', async () => {
    const setId = await attachSet();

    const brief = (await venueBrief(ids.event)).body.data;
    expect(brief.target).toMatchObject({ kind: 'base', event_id: ids.event, scene_set_id: setId, scene_set_name: 'The Glasshouse' });
    expect(brief.brief).toMatchObject({ event_id: ids.event, world_location_id: ids.location });
    expect(brief.prompt).toBe(briefToPrompt(brief.brief));
    expect(brief.estimate).toMatchObject({ images: 1 });
    expect(falCalls()).toHaveLength(0);

    const res = await generate(ids.event);

    expect(res.body.error).toBeUndefined();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, outcome: 'generated', data: { kind: 'base', scene_set_id: setId } });
    expect(res.body.skipped).toBeUndefined();
    const set = await models.SceneSet.findByPk(setId);
    expect(set.base_still_url).toBeTruthy();
    expect(res.body.data.venue_image_url).toBe(set.base_still_url);
    expect(set.base_generation.brief).toMatchObject({ event_id: ids.event });
    expect(set.base_runway_prompt).toBe(brief.prompt);
    expect(falCalls()).toHaveLength(1);
    expect(await eventSet()).toBe(setId); // the attached set is kept
  });

  it('an attached set with its image: already available, nothing generated', async () => {
    const setId = await attachSet({ base: 'https://cdn.example/glasshouse.jpg' });

    expect((await venueBrief(ids.event)).body.data.target).toMatchObject({ kind: 'already_available', scene_set_id: setId });
    const res = await generate(ids.event);

    expect(res.body).toMatchObject({ success: true, skipped: true, outcome: 'already_available', data: { scene_set_id: setId, venue_image_url: 'https://cdn.example/glasshouse.jpg' } });
    expect(falCalls()).toHaveLength(0);
  });

  it('an attached set that no longer exists: a new venue is generated and linked', async () => {
    const goneId = await attachSet({ deleted: true });

    expect((await venueBrief(ids.event)).body.data.target.kind).toBe('venue');
    const res = await generate(ids.event);

    expect(res.body).toMatchObject({ success: true, outcome: 'generated', data: { kind: 'venue' } });
    expect(res.body.data.scene_set_id).not.toBe(goneId);
    expect(await eventSet()).toBe(res.body.data.scene_set_id);
  });

  it('a generation that fails says so', async () => {
    await attachSet();
    axios.post.mockImplementation(async () => { throw Object.assign(new Error('provider down'), { response: { status: 400, data: {} } }); });

    const res = await generate(ids.event);

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false, outcome: 'failed' });
  });
});
