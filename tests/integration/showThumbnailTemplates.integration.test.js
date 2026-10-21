/**
 * A show's named thumbnail templates (Evoni, 2026-10-21: several per show,
 * e.g. Come Style Me, Haul, GRWM, each with a picture, renamed at will),
 * through the real routes on the migrated database. S3 and the picture
 * fetches are mocked with a small in-memory store; the drawing is real.
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
const templatesMigration = require('../../src/migrations/20261021130000-create-show-thumbnail-templates');

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
    { id: 'bg', role: 'background', kind: 'image', src: `${BUCKET_URL}pics/tpl-bg.png`, fit: 'cover', x: 0, y: 0, w: 1280, h: 720 },
    { id: 'title', role: 'title', kind: 'text', text: title, font: 'script', size: 120, x: 600, y: 200, w: 640, h: 300 },
  ],
});

(shouldSkip ? describe.skip : describe)('Named show templates (Templates › YouTube thumbnails)', () => {
  let token;
  let fetchSpy;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const base = '/api/v1/youtube-thumbnails';

  async function show(metadata = {}) {
    const id = uuid();
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:id, :name, :slug, CAST(:metadata AS jsonb), NOW(), NOW())`,
    { id, name: `Tpl ${id.slice(0, 8)}`, slug: `tpl-${id.slice(0, 8)}`, metadata: JSON.stringify(metadata) });
    return id;
  }

  beforeAll(async () => {
    await templatesMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-tpl', email: 'user@tpl.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    mockStore.set('pics/tpl-bg.png', await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#336699' } }).png().toBuffer());
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const key = String(url).startsWith(BUCKET_URL) ? String(url).slice(BUCKET_URL.length) : null;
      const body = key && mockStore.get(key);
      if (!body) return { ok: false, status: 404, headers: { get: () => null } };
      return { ok: true, status: 200, headers: { get: () => String(body.length) }, arrayBuffer: async () => body };
    });
  });

  afterAll(() => fetchSpy.mockRestore());

  test('the migration is guarded: running it again changes nothing', async () => {
    await templatesMigration.up(sequelize.getQueryInterface(), Sequelize);
    const [{ n }] = await rows("SELECT COUNT(*)::int AS n FROM pg_indexes WHERE tablename = 'show_thumbnail_templates'");
    expect(n).toBe(3);
  });

  test('save named templates: the first is the default; each gets a 640×360 picture', async () => {
    const s = await show();
    const first = await auth(request(app).post(`${base}/shows/${s}/templates`)).send({ name: '  Come  Style Me ', spec: spec() });
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ name: 'Come Style Me', isDefault: true, previewUrl: expect.stringContaining(`shows/${s}/thumbnail-templates/`) });
    const key = first.body.data.previewUrl.slice(BUCKET_URL.length);
    expect(await sharp(mockStore.get(key)).metadata()).toMatchObject({ width: 640, height: 360, format: 'jpeg' });
    const second = await auth(request(app).post(`${base}/shows/${s}/templates`)).send({ name: 'Haul', spec: spec('Haul') });
    expect(second.body.data).toMatchObject({ name: 'Haul', isDefault: false });
    const list = (await auth(request(app).get(`${base}/shows/${s}/templates`))).body.data;
    expect(list.map((t) => [t.name, t.isDefault])).toEqual([['Come Style Me', true], ['Haul', false]]);
    expect(list[1].spec.layers[1].text).toBe('Haul');
  });

  test('rename; the same name in any case is a 409; make default; delete passes the default on', async () => {
    const s = await show();
    const a = (await auth(request(app).post(`${base}/shows/${s}/templates`)).send({ name: 'GRWM', spec: spec() })).body.data;
    const b = (await auth(request(app).post(`${base}/shows/${s}/templates`)).send({ name: 'Haul', spec: spec() })).body.data;
    const renamed = await auth(request(app).patch(`${base}/shows/${s}/templates/${b.id}`)).send({ name: 'Big Haul' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe('Big Haul');
    const taken = await auth(request(app).patch(`${base}/shows/${s}/templates/${b.id}`)).send({ name: 'grwm' });
    expect(taken.status).toBe(409);
    expect(taken.body.error).toBe('That name is taken');
    expect((await auth(request(app).post(`${base}/shows/${s}/templates`)).send({ name: 'GRWM', spec: spec() })).status).toBe(409);
    expect((await auth(request(app).patch(`${base}/shows/${s}/templates/${b.id}`)).send({ name: ' ' })).status).toBe(400);
    expect((await auth(request(app).patch(`${base}/shows/${s}/templates/${b.id}`)).send({ isDefault: true })).body.data.isDefault).toBe(true);
    const defaults = await rows('SELECT name FROM show_thumbnail_templates WHERE show_id = :s AND is_default AND deleted_at IS NULL', { s });
    expect(defaults).toEqual([{ name: 'Big Haul' }]);
    expect((await auth(request(app).delete(`${base}/shows/${s}/templates/${b.id}`))).status).toBe(200);
    const list = (await auth(request(app).get(`${base}/shows/${s}/templates`))).body.data;
    expect(list).toEqual([expect.objectContaining({ id: a.id, isDefault: true })]);
    const [kept] = await rows('SELECT deleted_at FROM show_thumbnail_templates WHERE id = :id', { id: b.id });
    expect(kept.deleted_at).not.toBeNull();
  });

  test('a new layout replaces the layers and the picture; the episode starts from the default', async () => {
    const s = await show();
    const t = (await auth(request(app).post(`${base}/shows/${s}/templates`)).send({ name: 'Look', spec: spec() })).body.data;
    const changed = await auth(request(app).patch(`${base}/shows/${s}/templates/${t.id}`)).send({ spec: spec('New words') });
    expect(changed.body.data.spec.layers[1].text).toBe('New words');
    expect(changed.body.data.previewUrl).not.toBe(t.previewUrl);
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :s, 'Tpl ep', :n, 'draft', NOW(), NOW())`, { ep, s, n: Math.floor(Math.random() * 100000) + 900 });
    const src = (await auth(request(app).get(`${base}/episodes/${ep}/sources`))).body.data;
    expect(src.templates.map((x) => x.name)).toEqual(['Look']);
    expect(src.template.layers[1].text).toBe('New words');
  });

  test('the template kept before named ones stands in as "Default"; renaming it keeps it as a real one', async () => {
    const s = await show({ youtube_thumbnail: { template: spec('Old one') } });
    const before = (await auth(request(app).get(`${base}/shows/${s}/templates`))).body.data;
    expect(before).toEqual([expect.objectContaining({ id: 'legacy', name: 'Default', isDefault: true })]);
    const renamed = await auth(request(app).patch(`${base}/shows/${s}/templates/legacy`)).send({ name: 'The original' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data).toMatchObject({ name: 'The original', isDefault: true, previewUrl: expect.any(String) });
    expect(renamed.body.data.id).not.toBe('legacy');
    const after = (await auth(request(app).get(`${base}/shows/${s}/templates`))).body.data;
    expect(after.map((t) => t.name)).toEqual(['The original']);
    // Saving a second one keeps the first as the default.
    const s2 = await show({ youtube_thumbnail: { template: spec('Old two') } });
    await auth(request(app).post(`${base}/shows/${s2}/templates`)).send({ name: 'Haul', spec: spec() });
    const both = (await auth(request(app).get(`${base}/shows/${s2}/templates`))).body.data;
    expect(both.map((t) => [t.name, t.isDefault])).toEqual([['Default', true], ['Haul', false]]);
  });

  test('every show\'s templates for the Templates page; unknown ids are 404; signed in only', async () => {
    const s = await show();
    await auth(request(app).post(`${base}/shows/${s}/templates`)).send({ name: 'Page one', spec: spec() });
    const all = (await auth(request(app).get(`${base}/templates`))).body.data;
    const mine = all.find((g) => g.show.id === s);
    expect(mine.templates).toEqual([expect.objectContaining({ name: 'Page one', isDefault: true, previewUrl: expect.any(String) })]);
    expect(mine.templates[0].spec).toBeUndefined();
    expect((await auth(request(app).patch(`${base}/shows/${s}/templates/${uuid()}`)).send({ name: 'x' })).status).toBe(404);
    expect((await auth(request(app).patch(`${base}/shows/${s}/templates/nope`)).send({ name: 'x' })).status).toBe(404);
    expect((await auth(request(app).get(`${base}/shows/nope/templates`))).status).toBe(404);
    expect((await request(app).get(`${base}/templates`)).status).toBe(401);
  });
});
