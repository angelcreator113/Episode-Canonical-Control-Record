/**
 * An episode's thumbnail versions to compare (Evoni, 2026-10-21: "versions
 * to compare"), through the real routes on the migrated database. S3 and
 * the picture fetches are mocked with a small in-memory store; the drawing
 * is real.
 */
jest.unmock('uuid');

const mockStore = new Map();
const mockSend = jest.fn(async (cmd) => {
  const { Key, Body } = cmd.input || {};
  if (Body) mockStore.set(Key, Buffer.from(Body));
  return {};
});
process.env.S3_PRIMARY_BUCKET = process.env.S3_PRIMARY_BUCKET || 'test-bucket';

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: (...a) => mockSend(...a) })) };
});

const request = require('supertest');
const crypto = require('crypto');
const sharp = require('sharp');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const versionsMigration = require('../../src/migrations/20261021190000-create-episode-thumbnail-versions');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

const BUCKET_URL = `https://${process.env.S3_PRIMARY_BUCKET}.s3.us-east-1.amazonaws.com/`;

const spec = (title = 'Come Style Me') => ({
  version: 2,
  layers: [
    { id: 'bg', role: 'background', kind: 'image', src: `${BUCKET_URL}pics/ver-bg.png`, fit: 'cover', x: 0, y: 0, w: 1280, h: 720 },
    { id: 'title', role: 'title', kind: 'text', text: title, font: 'script', size: 120, x: 600, y: 200, w: 640, h: 300 },
  ],
});

(shouldSkip ? describe.skip : describe)('Thumbnail versions to compare (Templates › YouTube thumbnails)', () => {
  let token;
  let fetchSpy;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const base = '/api/v1/youtube-thumbnails';

  async function episode() {
    const showId = uuid();
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())`,
      { id: showId, name: `Ver ${showId.slice(0, 8)}`, slug: `ver-${showId.slice(0, 8)}` });
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:id, :showId, 'Version ep', :n, 'draft', NOW(), NOW())`, { id, showId, n: Math.floor(Math.random() * 100000) + 900 });
    return id;
  }

  beforeAll(async () => {
    await versionsMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-ver', email: 'user@ver.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    mockStore.set('pics/ver-bg.png', await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#663399' } }).png().toBuffer());
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const key = String(url).startsWith(BUCKET_URL) ? String(url).slice(BUCKET_URL.length) : null;
      const body = key && mockStore.get(key);
      if (!body) return { ok: false, status: 404, headers: { get: () => null } };
      return { ok: true, status: 200, headers: { get: () => String(body.length) }, arrayBuffer: async () => body };
    });
  });

  afterAll(() => fetchSpy.mockRestore());

  test('the migration is guarded: running it again changes nothing', async () => {
    await versionsMigration.up(sequelize.getQueryInterface(), Sequelize);
    const [{ n }] = await rows("SELECT COUNT(*)::int AS n FROM pg_indexes WHERE tablename = 'episode_thumbnail_versions'");
    expect(n).toBe(3);
  });

  test('keep versions: named Version A, B, ... unless named; each with a 640×360 picture; listed oldest first and in sources', async () => {
    const ep = await episode();
    const a = await auth(request(app).post(`${base}/episodes/${ep}/versions`)).send({ spec: spec('Red dress') });
    expect(a.status).toBe(201);
    expect(a.body.data).toMatchObject({ name: 'Version A', previewUrl: expect.stringContaining(`episodes/${ep}/thumbnail-versions/`) });
    const pic = mockStore.get(a.body.data.previewUrl.slice(BUCKET_URL.length));
    expect(await sharp(pic).metadata()).toMatchObject({ width: 640, height: 360, format: 'jpeg' });
    const b = await auth(request(app).post(`${base}/episodes/${ep}/versions`)).send({ spec: spec('Gold dress') });
    expect(b.body.data.name).toBe('Version B');
    const named = await auth(request(app).post(`${base}/episodes/${ep}/versions`)).send({ name: '  Bold  title ', spec: spec() });
    expect(named.body.data.name).toBe('Bold title');
    const list = (await auth(request(app).get(`${base}/episodes/${ep}/versions`))).body.data;
    expect(list.map((v) => v.name)).toEqual(['Version A', 'Version B', 'Bold title']);
    expect(list[0].spec.layers[1].text).toBe('Red dress');
    const src = (await auth(request(app).get(`${base}/episodes/${ep}/sources`))).body.data;
    expect(src.versions.map((v) => v.name)).toEqual(['Version A', 'Version B', 'Bold title']);
  });

  test('rename (a taken name is a 409, whatever its case); update with new layers redraws its picture; delete keeps the row', async () => {
    const ep = await episode();
    const a = (await auth(request(app).post(`${base}/episodes/${ep}/versions`)).send({ spec: spec() })).body.data;
    const b = (await auth(request(app).post(`${base}/episodes/${ep}/versions`)).send({ spec: spec() })).body.data;
    expect((await auth(request(app).patch(`${base}/episodes/${ep}/versions/${b.id}`)).send({ name: 'version a' })).status).toBe(409);
    const renamed = await auth(request(app).patch(`${base}/episodes/${ep}/versions/${b.id}`)).send({ name: 'Gold' });
    expect(renamed.body.data.name).toBe('Gold');
    const changed = await auth(request(app).patch(`${base}/episodes/${ep}/versions/${a.id}`)).send({ spec: spec('New words') });
    expect(changed.body.data.spec.layers[1].text).toBe('New words');
    expect(changed.body.data.previewUrl).not.toBe(a.previewUrl);
    expect((await auth(request(app).delete(`${base}/episodes/${ep}/versions/${a.id}`))).status).toBe(200);
    const list = (await auth(request(app).get(`${base}/episodes/${ep}/versions`))).body.data;
    expect(list.map((v) => v.name)).toEqual(['Gold']);
    const [kept] = await rows('SELECT deleted_at FROM episode_thumbnail_versions WHERE id = :id', { id: a.id });
    expect(kept.deleted_at).not.toBeNull();
    // A deleted version's name can be used again.
    expect((await auth(request(app).post(`${base}/episodes/${ep}/versions`)).send({ spec: spec() })).body.data.name).toBe('Version A');
  });

  test('at most 12; unknown ids are 404; bad layers 400; signed in only', async () => {
    const ep = await episode();
    for (let i = 0; i < 12; i += 1) {
      await run(`INSERT INTO episode_thumbnail_versions (episode_id, name, spec) VALUES (:ep, :name, CAST(:spec AS jsonb))`,
        { ep, name: `V${i}`, spec: JSON.stringify(spec()) });
    }
    const full = await auth(request(app).post(`${base}/episodes/${ep}/versions`)).send({ spec: spec() });
    expect(full.status).toBe(409);
    expect(full.body.error).toBe('An episode keeps up to 12 versions; delete one first');
    expect((await auth(request(app).patch(`${base}/episodes/${ep}/versions/${uuid()}`)).send({ name: 'x' })).status).toBe(404);
    expect((await auth(request(app).delete(`${base}/episodes/${ep}/versions/nope`))).status).toBe(404);
    expect((await auth(request(app).post(`${base}/episodes/${uuid()}/versions`)).send({ spec: spec() })).status).toBe(404);
    expect((await auth(request(app).post(`${base}/episodes/${ep}/versions`)).send({ spec: { version: 1 } })).status).toBe(400);
    expect((await request(app).get(`${base}/episodes/${ep}/versions`)).status).toBe(401);
  });
});
