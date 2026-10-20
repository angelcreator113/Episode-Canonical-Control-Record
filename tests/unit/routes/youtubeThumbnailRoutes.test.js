// ============================================================================
// YouTube thumbnail routes (/api/v1/youtube-thumbnails; Evoni, 2026-10-17):
// the preview is a PNG; saving renders, then stores it as the episode's
// primary thumbnail; a bad spec or an unknown episode is refused. Mocked:
// no database, no S3 (saveAsPrimary is a mock); the render is real.
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
  mockQuery.mockReset().mockImplementation(async (sql) => (/FROM episodes/.test(sql) ? [[{ id: 'ep-1' }]] : [[]]));
  yt.saveAsPrimary.mockClear();
});

test('render returns a 1280x720 PNG, with an uploaded background', async () => {
  const bg = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#7A2A6A' } }).png().toBuffer();
  const res = await request(app).post('/api/v1/youtube-thumbnails/render')
    .field('spec', JSON.stringify({ title: 'Studio by Sable', badge: 'EP 1', layout: 'center' }))
    .attach('background', bg, { filename: 'bg.png', contentType: 'image/png' })
    .buffer(true).parse(binary);
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/image\/png/);
  const meta = await sharp(res.body).metadata();
  expect([meta.width, meta.height]).toEqual([1280, 720]);
});

test('render refuses a spec with no title, and a non-S3 picture', async () => {
  const noTitle = await request(app).post('/api/v1/youtube-thumbnails/render').field('spec', JSON.stringify({}));
  expect(noTitle.status).toBe(400);
  expect(noTitle.body.error).toMatch(/needs a title/);
  const foreign = await request(app).post('/api/v1/youtube-thumbnails/render')
    .field('spec', JSON.stringify({ title: 'x', backgroundUrl: 'https://example.com/a.jpg' }));
  expect(foreign.status).toBe(400);
  expect(foreign.body.error).toMatch(/only S3 images/);
});

test('saving stores the render as the episode\'s primary thumbnail', async () => {
  const res = await request(app).post('/api/v1/youtube-thumbnails/episodes/ep-1')
    .field('spec', JSON.stringify({ title: 'Studio by Sable', badge: 'EP 1' }));
  expect(res.status).toBe(201);
  expect(res.body.data).toEqual({ id: 7, url: 'https://b.s3.amazonaws.com/t.png', key: 't.png' });
  expect(yt.saveAsPrimary).toHaveBeenCalledWith(expect.anything(), 'ep-1', expect.any(Buffer));
});

test('saving for an unknown episode is a 404, with nothing stored', async () => {
  mockQuery.mockResolvedValue([[]]);
  const res = await request(app).post('/api/v1/youtube-thumbnails/episodes/gone')
    .field('spec', JSON.stringify({ title: 'x' }));
  expect(res.status).toBe(404);
  expect(yt.saveAsPrimary).not.toHaveBeenCalled();
});

test('a non-image upload is refused', async () => {
  const res = await request(app).post('/api/v1/youtube-thumbnails/render')
    .field('spec', JSON.stringify({ title: 'x' }))
    .attach('background', Buffer.from('hi'), { filename: 'a.txt', contentType: 'text/plain' });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/Only images/);
});

test('the saved list, making one current, and a refused delete pass through', async () => {
  const list = await request(app).get('/api/v1/youtube-thumbnails/episodes/ep-1/saved');
  expect(list.status).toBe(200);
  expect(list.body.data).toEqual([{ id: 7, url: 'https://b.s3.amazonaws.com/t.png', isPrimary: true }]);
  const made = await request(app).post('/api/v1/youtube-thumbnails/episodes/ep-1/saved/6/primary');
  expect(made.status).toBe(200);
  expect(yt.makePrimary).toHaveBeenCalledWith(expect.anything(), 'ep-1', '6');
  const del = await request(app).delete('/api/v1/youtube-thumbnails/episodes/ep-1/saved/7');
  expect(del.status).toBe(409);
  expect(del.body.error).toMatch(/Make another one the thumbnail first/);
});
