/**
 * The old whole-episode post generator is retired (Evoni, 2026-10-17:
 * "retire the old episode feed button"): it wrote posts outside The Pulse's
 * drafter, past the Review gate, with no content types. An episode's posts
 * are drafted from its event in Admin › The Pulse › Engine.
 * - the route POST /feed-posts/:episodeId/generate is gone (404);
 * - the service keeps only persistFeedMoments (still used);
 * - the Feed Timeline page's button opens The Pulse › Engine instead.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', '..', ...p), 'utf8');

jest.mock('../../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  authorize: () => (req, res, next) => next(),
}));

test('POST /feed-posts/:episodeId/generate is gone', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/feed-posts', require('../../../src/routes/feedPostRoutes'));
  const res = await request(app).post('/api/v1/feed-posts/11111111-1111-1111-1111-111111111111/generate').send({ showId: 'x' });
  expect(res.status).toBe(404);
  expect(read('src', 'routes', 'feedPostRoutes.js')).not.toMatch(/router\.post\('\/:episodeId\/generate'/);
});

test('the service keeps only persistFeedMoments', () => {
  const svc = require('../../../src/services/feedPostGeneratorService');
  expect(Object.keys(svc)).toEqual(['persistFeedMoments']);
  expect(read('src', 'services', 'feedPostGeneratorService.js')).not.toMatch(/messages\.create/);
});

test('the Feed Timeline page sends Evoni to The Pulse › Engine instead of generating', () => {
  const page = read('frontend', 'src', 'pages', 'FeedTimelinePage.jsx');
  expect(page).not.toMatch(/feed-posts\/\$\{episodeId\}\/generate/);
  expect(page).toMatch(/const PULSE_ENGINE = '\/admin\?tab=pulse&sub=engine'/);
  expect(page).toMatch(/Draft posts in The Pulse › Engine/);
});
