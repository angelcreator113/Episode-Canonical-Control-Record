// ============================================================================
// YouTube thumbnail routes (/api/v1/youtube-thumbnails; Evoni, 2026-10-17):
// the drawing is a PNG of the layers (2026-10-21); saving draws, then
// stores it as the episode's primary thumbnail; what is not layers, or an
// unknown episode, is refused. Mocked: no database, no S3 (saveAsPrimary is
// a mock); the drawing is real (node-canvas).
// ============================================================================

const express = require('express');
const request = require('supertest');
const sharp = require('sharp');

const mockQuery = jest.fn();
jest.mock('../../../src/models', () => ({ sequelize: { query: (...a) => mockQuery(...a) } }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});
jest.mock('../../../src/services/youtubeThumbnailService', () => {
  const actual = jest.requireActual('../../../src/services/youtubeThumbnailService');
  return {
    ...actual,
    saveAsPrimary: jest.fn(async () => ({ id: 7, url: 'https://b.s3.amazonaws.com/t.png', key: 't.png' })),
    listSaved: jest.fn(async () => [{ id: 7, url: 'https://b.s3.amazonaws.com/t.png', isPrimary: true }]),
    makePrimary: jest.fn(async () => ({ id: 6, url: 'https://b.s3.amazonaws.com/s.png' })),
    removeSaved: jest.fn(async () => { throw new actual.ThumbnailError(409, 'This is the episode\'s thumbnail. Make another one the thumbnail first.'); }),
  };
});

const yt = require('../../../src/services/youtubeThumbnailService');
const router = require('../../../src/routes/youtubeThumbnailRoutes');

const app = express();
app.use(express.json());
app.use('/api/v1/youtube-thumbnails', router);

const binary = (res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

beforeEach(() => {
  mockQuery.mockReset().mockImplementation(async (sql) => (/FROM episodes/.test(sql) ? [[{ id: '11111111-2222-4333-8444-555555555555' }]] : [[]]));
  yt.saveAsPrimary.mockClear();
});

const LAYERS = {
  version: 2,
  layers: [
    { id: 'shade', role: 'shade', kind: 'shade', dim: 0, accent: '#B8962E', side: 'none' },
    { id: 'title', role: 'title', kind: 'text', text: 'Studio by Sable', font: 'serif', size: 80, x: 100, y: 200, w: 1080, h: 300 },
    { id: 'badge', role: 'badge', kind: 'badge', text: 'EP 1', x: 1060, y: 40, w: 170, h: 68 },
  ],
};

test('render draws the layers: a 1280x720 PNG', async () => {
  const res = await request(app).post('/api/v1/youtube-thumbnails/render').send(LAYERS).buffer(true).parse(binary);
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/image\/png/);
  const meta = await sharp(res.body).metadata();
  expect([meta.width, meta.height]).toEqual([1280, 720]);
});

test('render refuses what is not layers (the earlier spec too), and a picture that is not ours', async () => {
  const earlier = await request(app).post('/api/v1/youtube-thumbnails/render').send({ title: 'Studio by Sable', layout: 'center' });
  expect(earlier.status).toBe(400);
  expect(earlier.body.error).toMatch(/version: 2/);
  const foreign = await request(app).post('/api/v1/youtube-thumbnails/render')
    .send({ version: 2, layers: [{ kind: 'image', src: 'https://example.com/a.jpg' }] });
  expect(foreign.status).toBe(400);
  expect(foreign.body.error).toMatch(/not one of ours/);
});

test('saving stores the drawing as the episode\'s primary thumbnail', async () => {
  const res = await request(app).post('/api/v1/youtube-thumbnails/episodes/11111111-2222-4333-8444-555555555555').send(LAYERS);
  expect(res.status).toBe(201);
  expect(res.body.data).toEqual({ id: 7, url: 'https://b.s3.amazonaws.com/t.png', key: 't.png' });
  // The layers ride along, so a saved thumbnail can become the show's template.
  expect(yt.saveAsPrimary).toHaveBeenCalledWith(expect.anything(), '11111111-2222-4333-8444-555555555555', expect.any(Buffer), expect.objectContaining({ version: 2, layers: expect.any(Array) }));
});

test('saving for an unknown episode is a 404, with nothing stored', async () => {
  mockQuery.mockResolvedValue([[]]);
  const res = await request(app).post('/api/v1/youtube-thumbnails/episodes/gone').send(LAYERS);
  expect(res.status).toBe(404);
  expect(yt.saveAsPrimary).not.toHaveBeenCalled();
});

test('the saved list, making one current, and a refused delete pass through', async () => {
  const list = await request(app).get('/api/v1/youtube-thumbnails/episodes/11111111-2222-4333-8444-555555555555/saved');
  expect(list.status).toBe(200);
  expect(list.body.data).toEqual([{ id: 7, url: 'https://b.s3.amazonaws.com/t.png', isPrimary: true }]);
  const made = await request(app).post('/api/v1/youtube-thumbnails/episodes/11111111-2222-4333-8444-555555555555/saved/66666666-2222-4333-8444-555555555555/primary');
  expect(made.status).toBe(200);
  expect(yt.makePrimary).toHaveBeenCalledWith(expect.anything(), '11111111-2222-4333-8444-555555555555', '66666666-2222-4333-8444-555555555555');
  const del = await request(app).delete('/api/v1/youtube-thumbnails/episodes/11111111-2222-4333-8444-555555555555/saved/77777777-2222-4333-8444-555555555555');
  expect(del.status).toBe(409);
  expect(del.body.error).toMatch(/Make another one the thumbnail first/);
});

// Audit, 2026-10-22.
test('an id that is not a UUID is a 404 before the database is asked', async () => {
  for (const url of ['/episodes/not-a-uuid/sources', '/episodes/11111111-2222-4333-8444-555555555555/saved/7/primary', '/shows/1; DROP/templates', '/episodes/11111111-2222-4333-8444-555555555555/versions/x']) {
    mockQuery.mockClear();
    const res = await request(app)[url.endsWith('primary') ? 'post' : 'get']('/api/v1/youtube-thumbnails' + url);
    expect([url, res.status]).toEqual([url, 404]);
    expect(mockQuery).not.toHaveBeenCalled();
  }
});

test("a font's name is one of ours: \"constructor\" is a 404, not a crash", async () => {
  for (const key of ['constructor', 'toString', '__proto__', 'nope']) {
    const res = await request(app).get(`/api/v1/youtube-thumbnails/fonts/${key}`);
    expect([key, res.status]).toEqual([key, 404]);
  }
});

test("a database failure answers in plain words, not the database's", async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  yt.listSaved.mockRejectedValueOnce(new Error('relation "x" does not exist'));
  const res = await request(app).get('/api/v1/youtube-thumbnails/episodes/11111111-2222-4333-8444-555555555555/saved');
  expect(res.status).toBe(500);
  expect(res.body.error).not.toMatch(/relation/);
  const clash = new Error('duplicate key value violates unique constraint');
  clash.original = { code: '23505' };
  yt.listSaved.mockRejectedValueOnce(clash);
  const again = await request(app).get('/api/v1/youtube-thumbnails/episodes/11111111-2222-4333-8444-555555555555/saved');
  expect(again.status).toBe(409);
});
