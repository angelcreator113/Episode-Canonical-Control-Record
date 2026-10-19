
// ============================================================================
// A LalaVerse creator's social is The Pulse (Evoni, 2026-10-15). POST
// /social-profiles/generate saves a LalaVerse profile on The Pulse whatever
// platform the form sent (or none), and its prompt never offers a real app.
// JustAWoman's feed (real_world) keeps the platform asked for.
// Mocked, no database, no AI call (pattern: socialProfileRoutes-fit-lengths).
// ============================================================================

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-anthropic-key';

const express = require('express');
const request = require('supertest');
const { Sequelize, DataTypes } = require('sequelize');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return {
    ...actual,
    requireAuth: (req, res, next) => {
      // ADMIN: the Pulse people tools are admin only (Evoni, 2026-10-19).
      if (req.headers['x-test-user']) { req.user = { id: 'u1', groups: ['ADMIN'] }; return next(); }
      return actual.requireAuth(req, res, next);
    },
  };
});

const router = require('../../../src/routes/socialProfileRoutes');

const sequelize = new Sequelize('postgres://u:p@127.0.0.1:1/unused', { logging: false });
const RealSocialProfile = require('../../../src/models/SocialProfile')(sequelize, DataTypes);

const modelReply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

let db;
let app;

beforeEach(() => {
  mockCreate.mockReset();
  mockCreate.mockResolvedValue(modelReply({ display_name: 'Slow Sift', archetype: 'overnight_rise', follower_tier: 'mid' }));
  db = {
    SocialProfile: {
      rawAttributes: RealSocialProfile.rawAttributes,
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(async (record) => ({ id: 42, ...record, update: jest.fn() })),
      findByPk: jest.fn(async () => ({ id: 42, update: jest.fn() })),
    },
  };
  app = express();
  app.use(express.json());
  app.locals.db = db;
  app.use('/api/v1/social-profiles', router);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

const generate = (body) => request(app)
  .post('/api/v1/social-profiles/generate')
  .set('x-test-user', '1')
  .send({ handle: 'slowsift', vibe_sentence: 'Linen on a line, bread in a clay bowl.', ...body });

const promptOf = () => JSON.stringify(mockCreate.mock.calls[0][0]);

describe('POST /generate on The Pulse', () => {
  it.each([['instagram'], [undefined]])('a LalaVerse profile asked for with platform %s is saved on The Pulse', async (platform) => {
    const res = await generate({ platform, feed_layer: 'lalaverse', city: 'radiance_row' });
    expect(res.status).toBe(200);
    expect(db.SocialProfile.create.mock.calls[0][0].platform).toBe('pulse');
    expect(promptOf()).toContain('Platform: The Pulse');
    expect(promptOf()).toContain('Never name them');
  });

  it("JustAWoman's feed keeps the platform asked for, and its prompt has no Pulse rule", async () => {
    const res = await generate({ platform: 'instagram', feed_layer: 'real_world' });
    expect(res.status).toBe(200);
    expect(db.SocialProfile.create.mock.calls[0][0].platform).toBe('instagram');
    expect(promptOf()).not.toContain('The Pulse');
  });

  it('a real-world profile still needs a platform', async () => {
    const res = await generate({ feed_layer: 'real_world' });
    expect(res.status).toBe(400);
  });
});
