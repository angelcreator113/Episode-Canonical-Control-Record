// ============================================================================
// Her learned reading pace (Evoni, 2026-10-28), stored on
// Show.metadata.reading_pace (utils/readingPace). Mocked, no database.
// ============================================================================

const express = require('express');
const request = require('supertest');
const { readReadingPace, readReadingPaceBody, mergeReadingPace, MAX_EPISODES } = require('../../../src/utils/readingPace');

const mockShow = { current: null };
const mockUpdate = jest.fn();

jest.mock('../../../src/models', () => ({
  Show: {
    findByPk: jest.fn(async () => mockShow.current),
    sequelize: { transaction: jest.fn(async (fn) => fn({ LOCK: { UPDATE: 'UPDATE' } })) },
  },
  sequelize: { query: jest.fn(async () => []), QueryTypes: { SELECT: 'SELECT' } },
}));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});

const router = require('../../../src/routes/shows');

const app = express();
app.use(express.json());
app.use('/api/v1/shows', router);

const makeShow = (metadata) => {
  const show = { id: 'show-a', metadata };
  show.update = async (changes) => { mockUpdate(changes); Object.assign(show, changes); return show; };
  return show;
};

beforeEach(() => {
  mockUpdate.mockClear();
  mockShow.current = makeShow({ tagline: 'keep me', lala_home: { city: 'Paris' } });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('utils/readingPace', () => {
  it('reads nothing as nothing, and cleans what is stored', () => {
    expect(readReadingPace(null)).toEqual({});
    expect(readReadingPace({ reading_pace: { justawoman: { use: 'odd', episodes: { e1: { ratios: [0.87, 'x', -1, 99], takes: 2, at: '2026-10-28' }, e2: { ratios: [] } } }, hacker: {} } }))
      .toEqual({ justawoman: { use: 'mine', episodes: { e1: { ratios: [0.87], takes: 2, at: '2026-10-28' } } } });
  });
  it('refuses a body that says nothing or the wrong thing', () => {
    expect(readReadingPaceBody({}).error).toMatch(/Send use/);
    expect(readReadingPaceBody({ performer: 'nobody', use: 'mine' }).error).toMatch(/performer/);
    expect(readReadingPaceBody({ use: 'fast' }).error).toMatch(/use is/);
    expect(readReadingPaceBody({ episode_id: 'e1' }).error).toMatch(/ratios/);
    expect(readReadingPaceBody({ episode_id: 'e1', ratios: [0.9], takes: 2 }).value).toEqual({ performer: 'justawoman', episodeId: 'e1', ratios: [0.9], takes: 2 });
  });
  it('merges one episode in, keeps the others and the switch, and keeps the newest', () => {
    let meta = {};
    for (let i = 0; i < MAX_EPISODES + 2; i += 1) {
      meta = { reading_pace: mergeReadingPace(meta, { performer: 'justawoman', episodeId: `e${i}`, ratios: [0.9], takes: 1 }, `2026-10-${String(i + 1).padStart(2, '0')}T00:00:00Z`) };
    }
    expect(Object.keys(meta.reading_pace.justawoman.episodes)).toHaveLength(MAX_EPISODES);
    expect(meta.reading_pace.justawoman.episodes.e0).toBeUndefined();
    meta = { reading_pace: mergeReadingPace(meta, { performer: 'justawoman', use: 'standard' }) };
    expect(meta.reading_pace.justawoman.use).toBe('standard');
    expect(Object.keys(meta.reading_pace.justawoman.episodes)).toHaveLength(MAX_EPISODES);
    meta = { reading_pace: mergeReadingPace(meta, { performer: 'justawoman', episodeId: 'e13', ratios: [], takes: 0 }) };
    expect(meta.reading_pace.justawoman.episodes.e13).toBeUndefined();
    expect(meta.reading_pace.justawoman.use).toBe('standard');
  });
});

describe('GET/PUT /api/v1/shows/:id/reading-pace', () => {
  it('GET: nothing learned yet', async () => {
    const res = await request(app).get('/api/v1/shows/show-a/reading-pace');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: {} });
  });
  it('PUT: saves an episode and keeps every other metadata key', async () => {
    const res = await request(app).put('/api/v1/shows/show-a/reading-pace').send({ performer: 'justawoman', episode_id: 'ep-1', ratios: [0.87, 0.85, 0.9], takes: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data.justawoman.episodes['ep-1']).toMatchObject({ ratios: [0.87, 0.85, 0.9], takes: 2 });
    const saved = mockUpdate.mock.calls[0][0].metadata;
    expect(saved.tagline).toBe('keep me');
    expect(saved.lala_home).toEqual({ city: 'Paris' });
    const flip = await request(app).put('/api/v1/shows/show-a/reading-pace').send({ use: 'standard' });
    expect(flip.body.data.justawoman).toMatchObject({ use: 'standard' });
    expect(flip.body.data.justawoman.episodes['ep-1']).toBeTruthy();
  });
  it('PUT: 400 on a bad body, 404 on no show', async () => {
    expect((await request(app).put('/api/v1/shows/show-a/reading-pace').send({ use: 'fast' })).status).toBe(400);
    mockShow.current = null;
    expect((await request(app).put('/api/v1/shows/show-a/reading-pace').send({ use: 'mine' })).status).toBe(404);
    expect((await request(app).get('/api/v1/shows/show-a/reading-pace')).status).toBe(404);
  });
});
