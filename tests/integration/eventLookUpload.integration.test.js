/**
 * An event's look from an uploaded image (Evoni, 2026-10-15: each venue
 * has its everyday look, then each event's look, which can be her own image
 * as well as generated), on the migrated database through the real route.
 * S3 is stubbed.
 * - The look goes on the event's set, complete, source 'uploaded', no cost;
 *   the venue's everyday look (approved base) is neither needed nor touched.
 * - Several sets at the venue ask to choose (answer 3); scene_set_id picks.
 * - Generating afterwards marks the look 'generated' again.
 * - No file, a locked Place, and an unknown event are refused.
 */
jest.unmock('uuid');

const mockS3Send = jest.fn(async () => ({}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn((input) => ({ input })),
  DeleteObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
}));

process.env.FAL_KEY = process.env.FAL_KEY || 'test-fal-key';

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const sceneGen = require('../../src/services/sceneGenerationService');
const looksMigration = require('../../src/migrations/20261002130000-create-scene-set-looks');
const sourceMigration = require('../../src/migrations/20261015140000-add-scene-set-looks-source');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

(shouldSkip ? describe.skip : describe)('Upload this look', () => {
  const show = uuid();
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const upload = (eventId) => auth(request(app).post(`/api/v1/world/${show}/events/${eventId}/look/upload`));

  async function location(approvedUrl = 'https://x/everyday.jpg') {
    const id = uuid();
    await run(`INSERT INTO world_locations (id, name, description, approved_base_image_url, created_at, updated_at)
               VALUES (:id, 'The Glasshouse', 'A glass conservatory.', :approvedUrl, NOW(), NOW())`, { id, approvedUrl });
    return id;
  }
  async function sceneSet(locationId, name = 'Glasshouse Hall') {
    const id = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, world_location_id, base_still_url, generation_status, created_at, updated_at)
               VALUES (:id, :name, 'EVENT_LOCATION', :show, :locationId, 'https://x/base.jpg', 'complete', NOW(), NOW())`,
    { id, name, show, locationId });
    return id;
  }
  async function event(locationId, sceneSetId = null) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, venue_location_id, venue_name, scene_set_id, created_at, updated_at)
               VALUES (:id, :show, 'Velour Gala', 'invite', 'ready', 6, :locationId, 'The Glasshouse', :sceneSetId, NOW(), NOW())`,
    { id, show, locationId, sceneSetId });
    return id;
  }
  const lookOf = async (ev) => (await rows(`SELECT * FROM scene_set_looks WHERE event_id = :ev AND deleted_at IS NULL`, { ev }))[0];

  beforeAll(async () => {
    const qi = sequelize.getQueryInterface();
    await looksMigration.up(qi, Sequelize);
    await sourceMigration.up(qi, Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-look-upload', email: 'user@lookupload.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, '{}', NOW(), NOW())`,
      { id: show, name: `Look upload ${show.slice(0, 8)}`, slug: `look-upload-${show.slice(0, 8)}` });
  });
  beforeEach(() => {
    mockS3Send.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('the migration is re-runnable; existing looks read as generated', async () => {
    await sourceMigration.up(sequelize.getQueryInterface(), Sequelize);
    const [col] = await rows(`SELECT column_default, is_nullable FROM information_schema.columns
                               WHERE table_name = 'scene_set_looks' AND column_name = 'source'`);
    expect(col.is_nullable).toBe('NO');
    expect(col.column_default).toMatch(/generated/);
  });

  it('an uploaded image is the event\'s look: complete, uploaded, no cost; the everyday look is untouched', async () => {
    const loc = await location();
    const set = await sceneSet(loc);
    const ev = await event(loc, set);
    const res = await upload(ev).attach('image', PNG, { filename: 'gala.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ scene_set_id: set, look: { status: 'complete', source: 'uploaded' } });
    expect(res.body.data.look.image_url).toMatch(new RegExp(`scene-sets/${set}/looks/${ev}/upload-\\d+\\.png$`));
    expect(mockS3Send).toHaveBeenCalledTimes(1);
    expect(mockS3Send.mock.calls[0][0].input).toMatchObject({ ContentType: 'image/png' });

    const look = await lookOf(ev);
    expect(look).toMatchObject({ status: 'complete', source: 'uploaded', image_url: res.body.data.look.image_url, brief: null });
    expect(Number(look.cost_usd)).toBe(0);
    const [loc1] = await rows('SELECT approved_base_image_url FROM world_locations WHERE id = :loc', { loc });
    expect(loc1.approved_base_image_url).toBe('https://x/everyday.jpg');
    const [set1] = await rows('SELECT base_still_url FROM scene_sets WHERE id = :set', { set });
    expect(set1.base_still_url).toBe('https://x/base.jpg');

    // GET .../look shows it, with its source.
    const read = await auth(request(app).get(`/api/v1/world/${show}/events/${ev}/look`));
    expect(read.body.data.look).toMatchObject({ status: 'complete', source: 'uploaded' });
  });

  it('several sets at the venue: choose one first; scene_set_id uploads to it and links the event', async () => {
    const loc = await location();
    await sceneSet(loc, 'Hall A');
    const b = await sceneSet(loc, 'Hall B');
    const ev = await event(loc);
    const ask = await upload(ev).attach('image', PNG, { filename: 'gala.png', contentType: 'image/png' });
    expect(ask.status).toBe(409);
    expect(ask.body).toMatchObject({ code: 'CHOOSE_SET' });
    expect(ask.body.options).toHaveLength(2);
    expect(mockS3Send).not.toHaveBeenCalled();

    const res = await upload(ev).field('scene_set_id', b).attach('image', PNG, { filename: 'gala.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.data.scene_set_id).toBe(b);
    const [linked] = await rows('SELECT scene_set_id FROM world_events WHERE id = :ev', { ev });
    expect(linked.scene_set_id).toBe(b);
  });

  it('generating after an upload marks the look generated again', async () => {
    const loc = await location();
    const set = await sceneSet(loc);
    await run('UPDATE world_locations SET approved_base_scene_set_id = :set WHERE id = :loc', { set, loc });
    const ev = await event(loc, set);
    await upload(ev).attach('image', PNG, { filename: 'gala.png', contentType: 'image/png' });
    jest.spyOn(sceneGen, 'generateDressedStill').mockResolvedValue({ stillUrl: 'https://x/generated.jpg', cost: 0.04 });
    const gen = await auth(request(app).post(`/api/v1/world/${show}/events/${ev}/look/generate`)).send({});
    expect(gen.status).toBe(202);
    const end = Date.now() + 5000;
    while ((await lookOf(ev)).status === 'generating' && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
    expect(await lookOf(ev)).toMatchObject({ status: 'complete', source: 'generated', image_url: 'https://x/generated.jpg' });
  });

  it('no file, a locked Place, and an unknown event are refused', async () => {
    const loc = await location();
    const set = await sceneSet(loc);
    const ev = await event(loc, set);
    expect((await upload(ev)).status).toBe(400);
    expect((await upload(uuid()).attach('image', PNG, { filename: 'g.png', contentType: 'image/png' })).status).toBe(404);
    const placeLock = require('../../src/utils/placeLock');
    jest.spyOn(placeLock, 'isPlaceLocked').mockResolvedValue(true);
    const locked = await upload(ev).attach('image', PNG, { filename: 'g.png', contentType: 'image/png' });
    expect(locked.status).toBe(409);
    expect(locked.body.code).toBe(placeLock.PLACE_LOCKED_CODE);
    expect(mockS3Send).not.toHaveBeenCalled();
  });
});
