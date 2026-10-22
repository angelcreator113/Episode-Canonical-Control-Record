/**
 * The thumbnail as layers, through the real routes on the migrated database
 * (Evoni, 2026-10-21: move, resize and turn anything; the show's layout is
 * its template, an episode keeps its own arrangement). S3 and the picture
 * fetches are mocked with a small in-memory store; the drawing is real
 * (node-canvas, sharp).
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
const savedSpecMigration = require('../../src/migrations/20261022130000-add-spec-to-episode-saved-thumbnails');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

const BUCKET_URL = `https://${process.env.S3_PRIMARY_BUCKET}.s3.us-east-1.amazonaws.com/`;
const solid = (w, h, background) => sharp({ create: { width: w, height: h, channels: 3, background } }).png().toBuffer();

(shouldSkip ? describe.skip : describe)('Thumbnail layers (Templates › YouTube thumbnails)', () => {
  const show = uuid();
  let token;
  let fetchSpy;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const base = '/api/v1/youtube-thumbnails';

  async function episode() {
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Layers ep', :n, 'draft', NOW(), NOW())`, { ep, show, n: Math.floor(Math.random() * 100000) + 500 });
    return ep;
  }

  const spec = (bg) => ({
    version: 2,
    layers: [
      { id: 'bg', role: 'background', kind: 'image', src: bg, fit: 'cover', x: 0, y: 0, w: 1280, h: 720 },
      { id: 'shade', role: 'shade', kind: 'shade', dim: 0, accent: '#B8962E', side: 'none' },
      { id: 'title', role: 'title', kind: 'text', text: 'Come Style Me', font: 'script', size: 120, x: 600, y: 200, w: 640, h: 300, rotation: -8 },
    ],
  });

  beforeAll(async () => {
    await draftsMigration.up(sequelize.getQueryInterface(), Sequelize);
    await savedMigration.up(sequelize.getQueryInterface(), Sequelize);
    await savedSpecMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-layers', email: 'user@layers.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, '{"youtube_thumbnail":{"layout":"lala-right"}}', NOW(), NOW())`,
      { show, name: `Layers ${show.slice(0, 8)}`, slug: `layers-${show.slice(0, 8)}` });
    // Pictures are read back from the store, as S3 would serve them.
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const key = String(url).startsWith(BUCKET_URL) ? String(url).slice(BUCKET_URL.length) : null;
      const body = key && mockStore.get(key);
      if (!body) return { ok: false, status: 404, headers: { get: () => null } };
      return { ok: true, status: 200, headers: { get: () => String(body.length) }, arrayBuffer: async () => body };
    });
  });

  afterAll(() => fetchSpy.mockRestore());

  test('the migration is guarded: running it again changes nothing', async () => {
    await draftsMigration.up(sequelize.getQueryInterface(), Sequelize);
    const [{ n }] = await rows("SELECT COUNT(*)::int AS n FROM pg_indexes WHERE tablename = 'episode_thumbnail_drafts'");
    expect(n).toBe(2);
  });

  test('an uploaded picture is kept in S3 under the episode; a file that is not a picture is a 400', async () => {
    const ep = await episode();
    const res = await auth(request(app).post(`${base}/episodes/${ep}/pictures`))
      .attach('image', await solid(64, 64, '#123456'), { filename: 'mine.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    // The name rides in the key, so the episode's uploads list with their names.
    expect(res.body.data).toMatchObject({ label: 'Mine', url: expect.stringMatching(new RegExp(`^${BUCKET_URL}episodes/${ep}/thumbnail-pictures/\\d+-\\w+--mine\\.png$`)) });
    const bad = await auth(request(app).post(`${base}/episodes/${ep}/pictures`))
      .attach('image', Buffer.from('nope'), { filename: 'x.png', contentType: 'image/png' });
    expect(bad.status).toBe(400);
  });

  test('the draft: none at first; kept as checked layers; one per episode; the sources carry it', async () => {
    const ep = await episode();
    expect((await auth(request(app).get(`${base}/episodes/${ep}/draft`))).body.data).toBeNull();
    const first = await auth(request(app).put(`${base}/episodes/${ep}/draft`)).send(spec(`${BUCKET_URL}bg.png`));
    expect(first.status).toBe(200);
    const moved = spec(`${BUCKET_URL}bg.png`);
    moved.layers[2] = { ...moved.layers[2], x: 40, rotation: 999 };
    expect((await auth(request(app).put(`${base}/episodes/${ep}/draft`)).send(moved)).status).toBe(200);
    const draft = (await auth(request(app).get(`${base}/episodes/${ep}/draft`))).body.data;
    expect(draft.layers[2]).toMatchObject({ id: 'title', x: 40, rotation: 180 });
    const [{ n }] = await rows('SELECT COUNT(*)::int AS n FROM episode_thumbnail_drafts WHERE episode_id = :ep', { ep });
    expect(n).toBe(1);
    const sources = (await auth(request(app).get(`${base}/episodes/${ep}/sources`))).body.data;
    expect(sources.draft.layers.map((l) => l.id)).toEqual(['bg', 'shade', 'title']);
    expect(sources.template).toBeNull();
    // Not layers, or a picture that is not ours: refused.
    expect((await auth(request(app).put(`${base}/episodes/${ep}/draft`)).send({ layout: 'center' })).status).toBe(400);
    const foreign = spec('https://evil.example.com/bg.png');
    expect((await auth(request(app).put(`${base}/episodes/${ep}/draft`)).send(foreign)).status).toBe(400);
    expect((await auth(request(app).put(`${base}/episodes/${uuid()}/draft`)).send(spec(`${BUCKET_URL}bg.png`))).status).toBe(404);
  });

  test('render and save draw the layers: a 1280x720 PNG, saved as the episode\'s thumbnail', async () => {
    const ep = await episode();
    mockStore.set('pics/bg.png', await solid(1600, 900, '#0000FF'));
    const preview = await auth(request(app).post(`${base}/render`)).send(spec(`${BUCKET_URL}pics/bg.png`)).buffer(true)
      .parse((res, cb) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); });
    expect(preview.status).toBe(200);
    expect(preview.headers['content-type']).toMatch(/image\/png/);
    expect(await sharp(preview.body).metadata()).toMatchObject({ width: 1280, height: 720 });
    const saved = await auth(request(app).post(`${base}/episodes/${ep}`)).send(spec(`${BUCKET_URL}pics/bg.png`));
    expect(saved.status).toBe(201);
    const [row] = await rows('SELECT thumbnail_url FROM episodes WHERE id = :ep', { ep });
    expect(row.thumbnail_url).toBe(saved.body.data.url);
    expect(await sharp(mockStore.get(saved.body.data.key)).metadata()).toMatchObject({ width: 1280, height: 720 });
  });

  test('over YouTube\'s 2 MB: render and save give a JPEG under 2 MB (Evoni, 2026-10-21)', async () => {
    const noisy = await sharp(crypto.randomBytes(1280 * 720 * 3), { raw: { width: 1280, height: 720, channels: 3 } }).png().toBuffer();
    mockStore.set('pics/noisy.png', noisy);
    const binary = (r) => r.buffer(true).parse((res, cb) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    const res = await binary(auth(request(app).post(`${base}/render`)).send(spec(`${BUCKET_URL}pics/noisy.png`)));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/jpeg/);
    expect(Number(res.headers['x-thumbnail-bytes'])).toBe(res.body.length);
    expect(Number(res.headers['x-thumbnail-png-bytes'])).toBeGreaterThan(2 * 1024 * 1024);
    expect(res.body.length).toBeLessThanOrEqual(2 * 1024 * 1024);
    const ep = await episode();
    const saved = await auth(request(app).post(`${base}/episodes/${ep}`)).send(spec(`${BUCKET_URL}pics/noisy.png`));
    expect(saved.status).toBe(201);
    expect(saved.body.data).toMatchObject({ type: 'jpeg', key: expect.stringMatching(/\.jpg$/) });
    expect(saved.body.data.bytes).toBeLessThanOrEqual(2 * 1024 * 1024);
    const [row] = await rows('SELECT mime_type, file_size_bytes FROM episode_saved_thumbnails WHERE episode_id = :ep', { ep });
    expect(row).toMatchObject({ mime_type: 'image/jpeg' });
    expect(Number(row.file_size_bytes)).toBe(saved.body.data.bytes);
  });

  // Production's `thumbnails` table is older than its migration (Evoni,
  // 2026-10-22: "column "s3Bucket" does not exist"); the Studio keeps its own.
  test('saved thumbnails: listed current first; another made current; an older one deleted; the current one kept', async () => {
    await savedMigration.up(sequelize.getQueryInterface(), Sequelize); // guarded: a second run changes nothing
    const ep = await episode();
    mockStore.set('pics/bg.png', await solid(1600, 900, '#0000FF'));
    const first = (await auth(request(app).post(`${base}/episodes/${ep}`)).send(spec(`${BUCKET_URL}pics/bg.png`))).body.data;
    const second = (await auth(request(app).post(`${base}/episodes/${ep}`)).send(spec(`${BUCKET_URL}pics/bg.png`))).body.data;
    expect(first.id).toEqual(expect.any(String));

    let list = (await auth(request(app).get(`${base}/episodes/${ep}/saved`))).body.data;
    expect(list.map((t) => [t.id, t.isPrimary])).toEqual([[second.id, true], [first.id, false]]);
    expect(list[0]).toMatchObject({ url: second.url, width: 1280, height: 720 });
    // Each keeps the layers it was drawn from (so it can become the show's template).
    expect(list[0].spec.layers.map((l) => l.id)).toEqual(['bg', 'shade', 'title']);
    await savedSpecMigration.up(sequelize.getQueryInterface(), Sequelize); // guarded

    const made = await auth(request(app).post(`${base}/episodes/${ep}/saved/${first.id}/primary`));
    expect(made.status).toBe(200);
    list = (await auth(request(app).get(`${base}/episodes/${ep}/saved`))).body.data;
    expect(list.map((t) => [t.id, t.isPrimary])).toEqual([[first.id, true], [second.id, false]]);
    const [episodeRow] = await rows('SELECT thumbnail_url FROM episodes WHERE id = :ep', { ep });
    expect(episodeRow.thumbnail_url).toBe(first.url);

    expect((await auth(request(app).delete(`${base}/episodes/${ep}/saved/${first.id}`))).status).toBe(409);
    expect((await auth(request(app).delete(`${base}/episodes/${ep}/saved/${second.id}`))).status).toBe(200);
    list = (await auth(request(app).get(`${base}/episodes/${ep}/saved`))).body.data;
    expect(list.map((t) => t.id)).toEqual([first.id]);
    // Another episode's thumbnail, or an id that is not one: 404.
    expect((await auth(request(app).post(`${base}/episodes/${await episode()}/saved/${first.id}/primary`))).status).toBe(404);
    expect((await auth(request(app).post(`${base}/episodes/${ep}/saved/42/primary`))).status).toBe(404);
    // Nothing went to the older `thumbnails` table.
    const [{ n }] = await rows('SELECT COUNT(*)::int AS n FROM thumbnails WHERE "episodeId" = :ep', { ep });
    expect(n).toBe(0);
  });

  test('the show\'s template: saved with the style, kept when the style is saved without it, cleared with null', async () => {
    const t = spec(`${BUCKET_URL}pics/bg.png`);
    const put = await auth(request(app).put(`${base}/shows/${show}/style`)).send({ layout: 'lala-left', accent: '#B8962E', template: t });
    expect(put.status).toBe(200);
    const ep = await episode();
    let sources = (await auth(request(app).get(`${base}/episodes/${ep}/sources`))).body.data;
    expect(sources.template.layers.map((l) => l.role)).toEqual(['background', 'shade', 'title']);
    expect(sources.style).toMatchObject({ layout: 'lala-left', accent: '#B8962E' });
    await auth(request(app).put(`${base}/shows/${show}/style`)).send({ layout: 'center' });
    sources = (await auth(request(app).get(`${base}/episodes/${ep}/sources`))).body.data;
    expect(sources.style.layout).toBe('center');
    expect(sources.template).not.toBeNull();
    await auth(request(app).put(`${base}/shows/${show}/style`)).send({ layout: 'center', template: null });
    sources = (await auth(request(app).get(`${base}/episodes/${ep}/sources`))).body.data;
    expect(sources.template).toBeNull();
  });

  test('the editor\'s smaller copies: WebP, at most the width asked (400, 800 or 1600); a picture that is not ours is a 400; signed in only', async () => {
    mockStore.set('pics/big.png', await solid(3000, 2000, '#FF00AA'));
    const binary = (r) => r.buffer(true).parse((res, cb) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    const res = await binary(auth(request(app).get(`${base}/preview`)).query({ url: `${BUCKET_URL}pics/big.png`, w: 500 }));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/webp/);
    expect(await sharp(res.body).metadata()).toMatchObject({ format: 'webp', width: 800 });
    // Asked again: from the cache, not fetched from S3 again.
    const before = fetchSpy.mock.calls.length;
    await binary(auth(request(app).get(`${base}/preview`)).query({ url: `${BUCKET_URL}pics/big.png`, w: 1600 }));
    expect(fetchSpy.mock.calls.length).toBe(before);
    expect((await auth(request(app).get(`${base}/preview`)).query({ url: 'https://evil.example.com/x.png' })).status).toBe(400);
    expect((await request(app).get(`${base}/preview`).query({ url: `${BUCKET_URL}pics/big.png` })).status).toBe(401);
  });

  test('the editor\'s fonts: a known one is sent; anything else is a 404; signed in only', async () => {
    const font = await auth(request(app).get(`${base}/fonts/script`));
    expect(font.status).toBe(200);
    expect(font.headers['content-type']).toMatch(/font\/ttf/);
    expect((await auth(request(app).get(`${base}/fonts/nope`))).status).toBe(404);
    expect((await request(app).get(`${base}/fonts/script`)).status).toBe(401);
  });
});
