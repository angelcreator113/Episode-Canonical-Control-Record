/**
 * A whole season at once (Evoni, 2026-10-21), through the real routes on the
 * migrated database: the show's episodes with their thumbnails (or none) and
 * whether each has its own arrangement, and a small picture of a thumbnail
 * for the grid. S3 and the picture fetches are mocked with a small in-memory
 * store; the drawing is real (node-canvas, sharp).
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
const draftsMigration = require('../../src/migrations/20261021090000-create-episode-thumbnail-drafts');
const savedMigration = require('../../src/migrations/20261022090000-create-episode-saved-thumbnails');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

const BUCKET_URL = `https://${process.env.S3_PRIMARY_BUCKET}.s3.us-east-1.amazonaws.com/`;

(shouldSkip ? describe.skip : describe)('A whole season of thumbnails (Templates › YouTube thumbnails)', () => {
  const show = uuid();
  let token;
  let fetchSpy;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const base = '/api/v1/youtube-thumbnails';

  async function episode(n, title) {
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, :title, :n, 'draft', NOW(), NOW())`, { ep, show, n, title });
    return ep;
  }

  const spec = (title) => ({
    version: 2,
    layers: [
      { id: 'bg', role: 'background', kind: 'image', src: `${BUCKET_URL}season-bg.png`, fit: 'cover', x: 0, y: 0, w: 1280, h: 720 },
      { id: 'title', role: 'title', kind: 'text', text: title, font: 'sans', size: 120, x: 100, y: 200, w: 900, h: 300 },
    ],
  });

  beforeAll(async () => {
    await draftsMigration.up(sequelize.getQueryInterface(), Sequelize);
    await savedMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-season', email: 'user@season.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `Season ${show.slice(0, 8)}`, slug: `season-${show.slice(0, 8)}` });
    mockStore.set('season-bg.png', await sharp({ create: { width: 320, height: 180, channels: 3, background: '#335577' } }).png().toBuffer());
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const key = String(url).startsWith(BUCKET_URL) ? String(url).slice(BUCKET_URL.length) : null;
      const body = key && mockStore.get(key);
      if (!body) return { ok: false, status: 404, headers: { get: () => null } };
      return { ok: true, status: 200, headers: { get: () => String(body.length) }, arrayBuffer: async () => body };
    });
  });

  afterAll(() => fetchSpy.mockRestore());

  test('the season: every episode in order, with its thumbnail or none, and whether it has its own arrangement', async () => {
    const third = await episode(3, 'Gala Night');
    const first = await episode(1, 'Pilot');
    const second = await episode(2, 'Red Dress');
    // The first has a saved thumbnail; the second its own arrangement only.
    const saved = await auth(request(app).post(`${base}/episodes/${first}`)).send(spec('Pilot'));
    expect(saved.status).toBe(201);
    expect((await auth(request(app).put(`${base}/episodes/${second}/draft`)).send(spec('Red Dress'))).status).toBe(200);

    const res = await auth(request(app).get(`${base}/shows/${show}/season`));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { id: first, title: 'Pilot', episode_number: 1, thumbnailUrl: saved.body.data.url, hasDraft: false },
      { id: second, title: 'Red Dress', episode_number: 2, thumbnailUrl: null, hasDraft: true },
      { id: third, title: 'Gala Night', episode_number: 3, thumbnailUrl: null, hasDraft: false },
    ]);
  });

  test('an unknown show is a 404; signed out is a 401', async () => {
    expect((await auth(request(app).get(`${base}/shows/${uuid()}/season`))).status).toBe(404);
    expect((await auth(request(app).get(`${base}/shows/not-a-show/season`))).status).toBe(404);
    expect((await request(app).get(`${base}/shows/${show}/season`)).status).toBe(401);
  });

  // Evoni, 2026-10-22: the season's thumbnails, or versions for YouTube's Test & Compare, in one zip.
  test('a zip: each thumbnail drawn full size as it would be saved, numbered and named; bad items are a 400 before anything is sent', async () => {
    // A stored zip read from its central directory (no unzip package needed).
    const readZip = (buf) => {
      const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
      const count = buf.readUInt16LE(end + 10);
      let at = buf.readUInt32LE(end + 16);
      const files = {};
      for (let i = 0; i < count; i += 1) {
        const size = buf.readUInt32LE(at + 20);
        const nameLen = buf.readUInt16LE(at + 28);
        const skip = nameLen + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
        const local = buf.readUInt32LE(at + 42);
        const name = buf.toString('utf8', at + 46, at + 46 + nameLen);
        const data = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
        files[name] = buf.subarray(data, data + size);
        at += 46 + skip;
      }
      return files;
    };
    const res = await auth(request(app).post(`${base}/render/zip`))
      .send({ name: 'Season one', items: [{ name: 'Pilot', spec: spec('Pilot') }, { name: 'Red Dress!', spec: spec('Red Dress') }] })
      .buffer(true).parse((r, cb) => { const chunks = []; r.on('data', (c) => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks))); });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^application\/zip/);
    expect(res.headers['content-disposition']).toBe('attachment; filename="Season-one.zip"');
    const zip = readZip(res.body);
    expect(Object.keys(zip)).toEqual(['01-Pilot.png', '02-Red-Dress.png']);
    const first = zip['01-Pilot.png'];
    expect(await sharp(first).metadata()).toMatchObject({ format: 'png', width: 1280, height: 720 });
    expect(first.length).toBeLessThanOrEqual(2 * 1024 * 1024);

    const none = await auth(request(app).post(`${base}/render/zip`)).send({ items: [] });
    expect(none.status).toBe(400);
    const bad = await auth(request(app).post(`${base}/render/zip`)).send({ items: [{ name: 'A', spec: spec('A') }, { name: 'B', spec: { version: 2, layers: 'nope' } }] });
    expect(bad.status).toBe(400);
    expect(bad.headers['content-type']).toMatch(/json/);
    const tooMany = await auth(request(app).post(`${base}/render/zip`)).send({ items: Array.from({ length: 61 }, (_, i) => ({ name: `E${i}`, spec: spec('x') })) });
    expect(tooMany.status).toBe(400);
    expect((await request(app).post(`${base}/render/zip`).send({ items: [] })).status).toBe(401);
  });

  test('the small picture: the layers drawn 640 wide as a JPEG; bad layers are a 400', async () => {
    const res = await auth(request(app).post(`${base}/render/small`)).send(spec('Small')).buffer(true)
      .parse((r, cb) => { const chunks = []; r.on('data', (c) => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks))); });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^image\/jpeg/);
    const meta = await sharp(res.body).metadata();
    expect(meta).toMatchObject({ format: 'jpeg', width: 640, height: 360 });
    const bad = await auth(request(app).post(`${base}/render/small`)).send({ version: 2, layers: 'nope' });
    expect(bad.status).toBe(400);
  });
});
