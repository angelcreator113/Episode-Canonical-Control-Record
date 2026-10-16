/**
 * Scene Sets third audit (2026-10-15), the routes, on the test database:
 *  - an old base image another set still uses as its base was deleted;
 *  - a delete moved one show's uses onto another show's set, and a bad
 *    replacement id was a 500;
 *  - GET /artifact-categories was never reached (GET /:id took it);
 *  - bad ids and values on create, episodes, cover, reorder and
 *    learn-location were 500s, and any show's episode could be linked;
 *  - an object could name another set's angle;
 *  - the event-look and dressed-angle uploads answered a bad file with 500;
 *  - AI-suggested labels: too long threw after the paid call, all digits
 *    were saved empty.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));
const mockSend = jest.fn(async () => ({}));
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: mockSend })), DeleteObjectCommand: jest.fn((input) => ({ input, kind: 'delete' })) };
});

// A bucket name, so a delete reaches the (mocked) S3 client.
process.env.S3_PRIMARY_BUCKET = process.env.S3_PRIMARY_BUCKET || 'episode-assets';

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const sceneGen = require('../../src/services/sceneGenerationService');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const TEXT = Buffer.from('not an image');

(shouldSkip ? describe.skip : describe)('Scene set routes (third audit)', () => {
  let token;
  const saved = {};
  const setIds = [];
  const show = uuid();
  const otherShow = uuid();
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const api = (method, path) => auth(request(app)[method](`/api/v1/scene-sets${path}`));

  async function makeSet(fields = {}) {
    const set = await models.SceneSet.create({ name: `Routes3 ${uuid().slice(0, 8)}`, scene_type: 'HOME_BASE', base_still_url: 'https://x/base.jpg', show_id: show, ...fields });
    setIds.push(set.id);
    return set;
  }
  async function episode(showId) {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:id, :showId, 'Ep', :n, 'draft', NOW(), NOW())`, { id, showId, n: Math.floor(Math.random() * 100000) + 500 });
    return id;
  }

  beforeAll(async () => {
    await sequelize.query(`ALTER TABLE scene_sets ADD COLUMN IF NOT EXISTS cover_angle_id uuid`);
    await sequelize.query(`ALTER TABLE scene_angles
      ADD COLUMN IF NOT EXISTS angle_description text,
      ADD COLUMN IF NOT EXISTS camera_direction text`);
    token = TokenService.generateTokenPair({
      id: 'test-user-routes-audit3', email: 'user@routes-audit3.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    for (const [id, name] of [[show, 'Routes3'], [otherShow, 'Other3']]) {
      await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, '{}', NOW(), NOW())`,
        { id, name: `${name} ${id.slice(0, 8)}`, slug: `r3-${id.slice(0, 8)}` });
    }
  });
  beforeEach(() => {
    saved.key = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockReset();
    mockSend.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    if (saved.key === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved.key;
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    if (setIds.length) {
      await run('DELETE FROM scene_set_episodes WHERE scene_set_id IN (:ids)', { ids: setIds });
      await run('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { ids: setIds });
      await run('DELETE FROM scene_sets WHERE id IN (:ids)', { ids: setIds });
    }
  });

  it('an old base another set still uses as its base is kept; one nothing uses is deleted', async () => {
    const bucket = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
    const url = `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/scene-sets/shared-${uuid()}.jpg`;
    const mine = await makeSet({ base_still_url: url });
    const deletes = () => mockSend.mock.calls.filter(([cmd]) => cmd?.kind === 'delete');
    await makeSet({ base_still_url: url });
    await sceneGen.deleteOldBaseImage(url, sequelize, { setId: mine.id });
    expect(deletes()).toHaveLength(0);
    await run('UPDATE scene_sets SET base_still_url = NULL WHERE base_still_url = :url AND id <> :id', { url, id: mine.id });
    await sceneGen.deleteOldBaseImage(url, sequelize, { setId: mine.id });
    expect(deletes()).toHaveLength(1);
  });

  it('a delete moves uses only to a set of the same show (or one shared); a bad id is a 400', async () => {
    const set = await makeSet();
    const theirs = await makeSet({ show_id: otherShow });
    const shared = await makeSet({ show_id: null });
    expect((await api('delete', `/${set.id}?replacement_id=not-an-id`)).status).toBe(400);
    const res = await api('delete', `/${set.id}?replacement_id=${theirs.id}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/belongs to another show/);
    expect((await api('delete', `/${set.id}?replacement_id=${shared.id}`)).status).toBe(200);
  });

  it('GET /artifact-categories is reached', async () => {
    const res = await api('get', '/artifact-categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('bad ids and values are 400s; another show\'s episode is not linked', async () => {
    expect((await api('post', '/').send({ name: 'X', scene_type: 'EXTERIOR' })).status).toBe(400);
    expect((await api('post', '/').send({ name: 'X', scene_type: 'HOME_BASE', episode_ids: ['nope'] })).status).toBe(400);
    const set = await makeSet();
    expect((await api('post', `/${set.id}/episodes`).send({ episode_ids: ['nope'] })).status).toBe(400);
    expect((await api('post', `/${set.id}/episodes`).send({ episode_ids: [uuid()] })).status).toBe(400);
    const foreign = await api('post', `/${set.id}/episodes`).send({ episode_ids: [await episode(otherShow)] });
    expect(foreign.status).toBe(400);
    expect(foreign.body.error).toMatch(/another show/);
    expect((await api('post', `/${set.id}/episodes`).send({ episode_ids: [await episode(show)] })).status).toBe(200);
    expect((await api('patch', `/${set.id}/cover-angle`).send({ angle_id: 'nope' })).status).toBe(400);
    expect((await api('patch', `/${set.id}/angles/reorder`).send({ order: [{ id: 'nope', sort_order: 1 }] })).status).toBe(400);
    expect((await api('post', `/${set.id}/learn-location`).send({ parent_location_id: 'nope' })).status).toBe(400);
    expect((await api('post', `/${set.id}/learn-location`).send({ parent_location_id: uuid() })).status).toBe(400);
  });

  it('an object names an angle of its own set only', async () => {
    const set = await makeSet();
    const other = await makeSet();
    const theirAngle = await models.SceneAngle.create({ scene_set_id: other.id, angle_label: 'WIDE', angle_name: 'Wide', generation_status: 'pending' });
    expect((await api('post', `/${set.id}/objects`).send({ object_type: 'image', scene_angle_id: theirAngle.id })).status).toBe(400);
    expect((await api('post', `/${set.id}/objects`).send({ object_type: 'image', scene_angle_id: 'nope' })).status).toBe(400);
  });

  it('a bad file on the event-look and dressed-angle uploads is a 400, a bad id too', async () => {
    const look = await auth(request(app).post(`/api/v1/world/${show}/events/${uuid()}/look/upload`))
      .attach('image', TEXT, { filename: 'notes.txt', contentType: 'text/plain' });
    expect(look.status).toBe(400);
    expect(look.body.code).toBe('BAD_FILE');
    const dressed = await auth(request(app).post(`/api/v1/episode-brief/${uuid()}/dressed-angles/${uuid()}/upload`))
      .attach('image', TEXT, { filename: 'notes.txt', contentType: 'text/plain' });
    expect(dressed.status).toBe(400);
    expect(dressed.body.code).toBe('BAD_FILE');
    expect((await auth(request(app).post(`/api/v1/episode-brief/${uuid()}/dressed-angles/nope/brief`)).send({})).status).toBe(400);
  });

  it('AI-suggested labels fit the column, are never empty, and are not repeated', async () => {
    const set = await makeSet();
    mockCreate.mockResolvedValue({ content: [{ text: JSON.stringify([
      { label: `${'A'.repeat(70)}`, name: 'Long' },
      { label: '1234', name: 'Digits' },
      { label: 'bar', name: 'Bar' },
      { label: 'BAR', name: 'Bar again' },
    ]) }] });
    const res = await api('post', `/${set.id}/suggest-angles-from-image`).send({});
    expect(res.status).toBe(200);
    const labels = (await rows('SELECT angle_label FROM scene_angles WHERE scene_set_id = :id ORDER BY sort_order', { id: set.id })).map((r) => r.angle_label);
    expect(labels).toEqual(['A'.repeat(50), 'OTHER', 'BAR']);
  });
});
