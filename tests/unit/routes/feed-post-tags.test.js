// ============================================================================
// Story Clock (Evoni, 2026-10-17): a post's tags and the planner's day.
// cleanTags keeps tags tidy; POST and PUT take them; PUT /:id/tags works on
// a live post too; ?day_from=&day_to= keeps the posts going out in that
// window. Mocked models; no database.
// ============================================================================

const express = require('express');
const request = require('supertest');
const { Op } = require('sequelize');

const mockFeedPost = { findByPk: jest.fn(), findAll: jest.fn(), count: jest.fn(), create: jest.fn() };
jest.mock('../../../src/models', () => ({
  FeedPost: mockFeedPost,
  sequelize: { literal: (s) => ({ literal: s }) },
}));
jest.mock('../../../src/middleware/auth', () => ({
  optionalAuth: (req, _res, next) => next(),
  requireAuth: (req, _res, next) => { req.user = { id: 'u1', groups: ['admin'] }; next(); },
  authorize: () => (req, _res, next) => next(),
  userInGroup: () => true,
}));
jest.mock('../../../src/services/lalaFeedProfile', () => ({ lalaProfileId: async () => null }));
jest.mock('../../../src/services/storyClock', () => ({ presentOrder: async () => 17 }));
jest.mock('../../../src/services/pulseNumbers', () => ({ applyNumbers: async (_m, d) => d, proposeLater: jest.fn() }));
jest.mock('../../../src/services/pulseCloseness', () => ({ proposeLater: jest.fn() }));
jest.mock('../../../src/utils/feedPlaces', () => ({ withPlaces: async (_m, d) => d, resolvePlace: async () => ({ values: {} }) }));

const { cleanTags } = require('../../../src/utils/postTags');
const router = require('../../../src/routes/feedPostRoutes');

const app = express();
app.use(express.json());
app.use('/api/v1/feed-posts', router);

const postOf = (fields) => ({ ...fields, get: () => fields, toJSON: () => fields, update: jest.fn(async function u(next) { Object.assign(fields, next); }) });

beforeEach(() => {
  Object.values(mockFeedPost).forEach((fn) => fn.mockReset());
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('cleanTags', () => {
  test('trims, collapses spaces, drops empties and repeats, keeps the first spelling', () => {
    expect(cleanTags(['  Studio ', 'design   process', '', 'studio', 'BTS'])).toEqual({ tags: ['Studio', 'design process', 'BTS'] });
  });
  test('refuses what is not a short list of text', () => {
    expect(cleanTags('Studio').error).toMatch(/list/);
    expect(cleanTags([3]).error).toMatch(/text/);
    expect(cleanTags(['x'.repeat(41)]).error).toMatch(/40 characters/);
    expect(cleanTags(Array.from({ length: 13 }, (_, i) => `t${i}`)).error).toMatch(/12 tags/);
  });
});

describe('tags on posts', () => {
  test('POST saves tidy tags with the new post', async () => {
    mockFeedPost.create.mockImplementation(async (v) => postOf({ id: 'p1', ...v }));
    const res = await request(app).post('/api/v1/feed-posts')
      .send({ show_id: 's1', content_text: 'a quiet kind of focus', status: 'draft', tags: ['Studio', ' studio ', 'BTS'] });
    expect(res.status).toBe(200);
    expect(mockFeedPost.create.mock.calls[0][0].tags).toEqual(['Studio', 'BTS']);
  });

  test('POST refuses bad tags before creating anything', async () => {
    const res = await request(app).post('/api/v1/feed-posts').send({ show_id: 's1', content_text: 'x', tags: 'Studio' });
    expect(res.status).toBe(400);
    expect(mockFeedPost.create).not.toHaveBeenCalled();
  });

  test("PUT /:id saves a draft's tags", async () => {
    const post = postOf({ id: 'p1', status: 'draft', content_text: 'x' });
    mockFeedPost.findByPk.mockResolvedValue(post);
    const res = await request(app).put('/api/v1/feed-posts/p1').send({ tags: ['Notes'] });
    expect(res.status).toBe(200);
    expect(post.update).toHaveBeenCalledWith(expect.objectContaining({ tags: ['Notes'] }));
  });

  test('PUT /:id/tags tags a live post; its words stay locked', async () => {
    const post = postOf({ id: 'p2', status: 'live', content_text: 'x' });
    mockFeedPost.findByPk.mockResolvedValue(post);
    const ok = await request(app).put('/api/v1/feed-posts/p2/tags').send({ tags: ['Lunch'] });
    expect(ok.status).toBe(200);
    expect(post.update).toHaveBeenCalledWith({ tags: ['Lunch'] });
    const locked = await request(app).put('/api/v1/feed-posts/p2').send({ content_text: 'y' });
    expect(locked.status).toBe(409);
  });

  test('PUT /:id/tags: unknown post 404, bad tags 400', async () => {
    mockFeedPost.findByPk.mockResolvedValue(null);
    expect((await request(app).put('/api/v1/feed-posts/nope/tags').send({ tags: [] })).status).toBe(404);
    expect((await request(app).put('/api/v1/feed-posts/p1/tags').send({ tags: [1] })).status).toBe(400);
  });
});

describe('?day_from=&day_to=', () => {
  test("keeps drafts released in the window and live posts posted in it, earliest first", async () => {
    mockFeedPost.findAll.mockResolvedValue([]);
    mockFeedPost.count.mockResolvedValue(0);
    const from = '2026-10-16T06:00:00.000Z';
    const to = '2026-10-17T06:00:00.000Z';
    const res = await request(app).get(`/api/v1/feed-posts?show_id=s1&status=all&day_from=${from}&day_to=${to}`);
    expect(res.status).toBe(200);
    const { where, order } = mockFeedPost.findAll.mock.calls[0][0];
    const window = { [Op.gte]: new Date(from), [Op.lt]: new Date(to) };
    expect(where[Op.and]).toContainEqual({ [Op.or]: [{ release_at: window }, { status: 'live', posted_at: window }] });
    expect(order[0][0].literal).toMatch(/COALESCE\("FeedPost"\."release_at", "FeedPost"\."posted_at"\)/);
  });

  test('refuses a missing, backwards or too-long window', async () => {
    for (const q of ['day_from=2026-10-16T06:00:00Z', 'day_from=2026-10-17T00:00:00Z&day_to=2026-10-16T00:00:00Z', 'day_from=2026-10-01T00:00:00Z&day_to=2026-10-16T00:00:00Z']) {
      const res = await request(app).get(`/api/v1/feed-posts?show_id=s1&${q}`);
      expect(res.status).toBe(400);
    }
    expect(mockFeedPost.findAll).not.toHaveBeenCalled();
  });
});
