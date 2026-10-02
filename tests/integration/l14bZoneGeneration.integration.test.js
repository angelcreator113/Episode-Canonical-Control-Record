/**
 * L14 (b) (Evoni, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(hh)): "each zone
 * is generated with the set's approved base (or its base, if none is
 * approved) as the style and architecture reference, so Front, Inside and
 * Back read as one place; show the cost first."
 *
 * Against the test database, with the provider (axios), S3 and sharp mocked:
 * - a zone is one Flux Kontext call whose image is the set's base, or the
 *   location's approved base when this set is the approved one; its prompt
 *   is the zone's establishing camera, never "only the camera moved";
 * - a set with no base refuses (409 NO_BASE) and makes no call;
 * - POST /scene-sets/:id/brief for a zone shows the zone, its reference and
 *   the Kontext estimate before anything is generated.
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

jest.mock('sharp', () => {
  const chain = () => {
    const c = {};
    for (const m of ['resize', 'jpeg', 'png', 'extract', 'composite', 'grayscale', 'blur', 'normalize', 'rotate', 'webp', 'metadata']) c[m] = () => c;
    c.toBuffer = async () => Buffer.from('img');
    c.metadata = async () => ({ width: 1920, height: 1080 });
    return c;
  };
  return jest.fn(() => chain());
});

const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const request = require('supertest');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const sceneGen = require('../../src/services/sceneGenerationService');
const baseModelMigration = require('../../src/migrations/20261001140000-add-scene-sets-base-model');
const approvedMigration = require('../../src/migrations/20261001220000-world-locations-approved-base');
const kindMigration = require('../../src/migrations/20261002120000-add-scene-angle-kind');
const zoneMigration = require('../../src/migrations/20261002170000-scene-angle-zones');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const KONTEXT = 'https://fal.run/fal-ai/flux-pro/kontext';
const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('L14 (b): zones generated from the set\'s base', () => {
  let token;
  const saved = {};
  const setIds = [];
  const locationIds = [];
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function location() {
    const id = uuid();
    await run(`INSERT INTO world_locations (id, name, location_type, city, created_at, updated_at)
               VALUES (:id, 'The Glasshouse', 'venue', 'Los Angeles', NOW(), NOW())`, { id });
    locationIds.push(id);
    return id;
  }
  async function sceneSet({ base = true, locationId = null } = {}) {
    const id = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, world_location_id, canonical_description, base_still_url, generation_status, created_at, updated_at)
               VALUES (:id, 'The Glasshouse', 'OTHER', :locationId, 'A glass conservatory venue.', :base, 'complete', NOW(), NOW())`,
    { id, locationId, base: base ? `https://x/${id}-base.jpg` : null });
    setIds.push(id);
    return id;
  }
  async function zone(setId, kind, name) {
    const id = uuid();
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, angle_kind, generation_status, beat_affinity, sort_order, created_at, updated_at)
               VALUES (:id, :setId, :name, 'OTHER', :kind, 'pending', '[]', 0, NOW(), NOW())`, { id, setId, name, kind });
    return id;
  }
  const load = async (setId, angleId) => [await models.SceneAngle.findByPk(angleId), await models.SceneSet.findByPk(setId)];
  const kontextCalls = () => axios.post.mock.calls.filter(([url]) => url === KONTEXT);

  beforeAll(async () => {
    const qi = sequelize.getQueryInterface();
    await sequelize.query(`ALTER TABLE scene_sets
      ADD COLUMN IF NOT EXISTS style_reference_url text,
      ADD COLUMN IF NOT EXISTS negative_prompt text,
      ADD COLUMN IF NOT EXISTS variation_count integer DEFAULT 1,
      ADD COLUMN IF NOT EXISTS cover_angle_id uuid`);
    for (const m of [baseModelMigration, approvedMigration, kindMigration, zoneMigration]) await m.up(qi, Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-l14b', email: 'user@l14b.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  beforeEach(() => {
    for (const k of ['FAL_KEY', 'ANTHROPIC_API_KEY', 'AI_DAILY_IMAGE_BUDGET_USD', 'AI_DAILY_BUDGET_USD']) saved[k] = process.env[k];
    process.env.FAL_KEY = 'test-fal';
    delete process.env.ANTHROPIC_API_KEY;
    process.env.AI_DAILY_IMAGE_BUDGET_USD = '100000';
    process.env.AI_DAILY_BUDGET_USD = '100000';
    axios.post.mockReset();
    axios.get.mockReset();
    axios.get.mockImplementation(async () => ({ data: Buffer.from('jpg') }));
    axios.post.mockImplementation(async (url) => {
      if (url.startsWith('https://fal.run/')) return { status: 200, data: { images: [{ url: 'https://fal.media/zone.jpg' }] } };
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
    if (setIds.length) {
      await run('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { ids: setIds });
      await run('UPDATE world_locations SET approved_base_scene_set_id = NULL WHERE id IN (:ids)', { ids: locationIds.length ? locationIds : [uuid()] });
      await run('DELETE FROM scene_sets WHERE id IN (:ids)', { ids: setIds });
    }
    if (locationIds.length) await run('DELETE FROM world_locations WHERE id IN (:ids)', { ids: locationIds });
    await sequelize.close();
  });

  it('a zone is one Kontext edit of the set\'s base, with the zone\'s own camera', async () => {
    const locationId = await location();
    const setId = await sceneSet({ locationId });
    const angleId = await zone(setId, 'back', 'Green room');

    await sceneGen.generateAngle(...await load(setId, angleId), models);

    const calls = kontextCalls();
    expect(calls).toHaveLength(1);
    expect(axios.post.mock.calls).toHaveLength(1); // no crop, outpaint or other provider call
    expect(calls[0][1].image_url).toBe(`https://x/${setId}-base.jpg`);
    expect(calls[0][1].prompt).toContain('Establishing view of the back of The Glasshouse (Green room)');
    expect(calls[0][1].prompt).toContain('a different part of it, not the same view');
    expect(calls[0][1].prompt).not.toMatch(/only the camera moved/);
    const [row] = await load(setId, angleId);
    expect(row.generation_status).toBe('complete');
    expect(row.still_image_url).toBeTruthy();
    expect(row.quality_review.zone_reference).toMatchObject({ source: 'base', model: 'flux-kontext' });
  });

  it('the approved base is the reference when this set is the approved one', async () => {
    const locationId = await location();
    const setId = await sceneSet({ locationId });
    await run(`UPDATE world_locations SET approved_base_scene_set_id = :setId, approved_base_image_url = 'https://x/approved.jpg', approved_base_at = NOW()
                WHERE id = :locationId`, { setId, locationId });
    const angleId = await zone(setId, 'front', 'Front');

    await sceneGen.generateAngle(...await load(setId, angleId), models);

    const calls = kontextCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1].image_url).toBe('https://x/approved.jpg');
    expect(calls[0][1].prompt).toContain('Establishing view of the front of The Glasshouse: the exterior, the entrance and the approach');
  });

  it('a set with no base refuses with NO_BASE and makes no call', async () => {
    const setId = await sceneSet({ base: false });
    const angleId = await zone(setId, 'inside', 'Main room');

    await expect(sceneGen.generateAngle(...await load(setId, angleId), models)).rejects.toMatchObject({ status: 409, code: 'NO_BASE' });
    const res = await auth(request(app).post(`/api/v1/scene-sets/${setId}/angles/${angleId}/generate`)).send({});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NO_BASE');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('the brief shows the zone, its reference and the Kontext estimate first', async () => {
    const setId = await sceneSet();
    const angleId = await zone(setId, 'area', 'Bar');

    const res = await auth(request(app).post(`/api/v1/scene-sets/${setId}/brief`)).send({ angle_id: angleId });

    expect(res.status).toBe(200);
    expect(res.body.data.target).toMatchObject({
      kind: 'zone', zone_kind: 'area', angle_id: angleId, reference_image_url: `https://x/${setId}-base.jpg`, reference_source: 'base',
    });
    const e = sceneGen.estimateDressingCost();
    expect(res.body.data.estimate).toMatchObject({ usd: e.usd, priced: e.priced, base_model: 'flux-kontext' });
    expect(res.body.data.prompt).toContain('Establishing view of the Bar area of The Glasshouse.');
    expect(axios.post).not.toHaveBeenCalled();
  });
});
