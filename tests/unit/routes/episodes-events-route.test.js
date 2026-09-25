// ============================================================================
// GET /api/v1/episodes/:id/events (Task #1906)
// ============================================================================
// The one reader the episode tabs use for "which events is this episode
// made from". requireAuth; the anchor comes from EpisodeBrief.event_id and
// additional events from world_events.used_in_episode_id. Mocked models,
// no database.

const express = require('express');
const request = require('supertest');

const EP = '11111111-1111-4111-8111-111111111111';
const EP_DELETED = '22222222-2222-4222-8222-222222222222';

const mockEvents = [
  { id: 'ev-anchor', name: 'Gala', used_in_episode_id: null },
  { id: 'ev-extra', name: 'Brunch', used_in_episode_id: EP },
];

jest.mock('../../../src/models', () => ({
  // The controllers episodes.js requires destructure this map at load.
  models: {},
  Episode: {
    findByPk: jest.fn(async (id) => {
      if (id === '11111111-1111-4111-8111-111111111111') return { id, deleted_at: null };
      if (id === '22222222-2222-4222-8222-222222222222') return { id, deleted_at: new Date() };
      return null;
    }),
  },
  EpisodeBrief: {
    findOne: jest.fn(async ({ where }) => (where.episode_id === '11111111-1111-4111-8111-111111111111'
      ? { id: 'brief-1', event_id: 'ev-anchor' } : null)),
  },
  WorldEvent: {
    CURRENT_ATTRIBUTES: ['id', 'name', 'used_in_episode_id'],
    findAll: jest.fn(async ({ where }) => mockEvents
      .filter((ev) => Object.entries(where).every(([k, v]) => ev[k] === v))
      .map((ev) => ({ toJSON: () => ({ ...ev }) }))),
  },
}));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return {
    ...actual,
    requireAuth: (req, res, next) => {
      if (req.headers.authorization !== 'Bearer ok') return res.status(401).json({ error: 'unauthorized' });
      req.user = { id: 'u1' };
      return next();
    },
  };
});

const router = require('../../../src/routes/episodes');

const app = express();
app.use(express.json());
app.use('/api/v1/episodes', router);

describe('GET /api/v1/episodes/:id/events (Task #1906)', () => {
  test('requires auth', async () => {
    const res = await request(app).get(`/api/v1/episodes/${EP}/events`);
    expect(res.status).toBe(401);
  });

  test('returns the brief anchor first (even unstamped) and every linked event', async () => {
    const res = await request(app).get(`/api/v1/episodes/${EP}/events`).set('Authorization', 'Bearer ok');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.anchor_event_id).toBe('ev-anchor');
    expect(res.body.anchor_source).toBe('brief');
    expect(res.body.events.map((ev) => ev.id)).toEqual(['ev-anchor', 'ev-extra']);
    expect(res.body.events[0].link).toMatchObject({ anchor: true, stamped: false });
  });

  test('404 for an unknown or soft-deleted episode', async () => {
    const missing = await request(app).get('/api/v1/episodes/33333333-3333-4333-8333-333333333333/events').set('Authorization', 'Bearer ok');
    expect(missing.status).toBe(404);
    const deleted = await request(app).get(`/api/v1/episodes/${EP_DELETED}/events`).set('Authorization', 'Bearer ok');
    expect(deleted.status).toBe(404);
  });
});
