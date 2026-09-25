// ============================================================================
// Task #1844 — POST /social-profiles/generate and POST /:id/regenerate fit
// every generated string to its column's declared length before the write,
// and a remaining "value too long" (22001) failure names the field in the log.
// Mocked, no database, no AI call: the Anthropic SDK is a jest mock, the route
// is mounted alone, and the lengths come from the real SocialProfile model's
// rawAttributes (the Sequelize instance is never connected).
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
      if (req.headers['x-test-user']) { req.user = { id: 'u1' }; return next(); }
      return actual.requireAuth(req, res, next);
    },
  };
});

const router = require('../../../src/routes/socialProfileRoutes');

const sequelize = new Sequelize('postgres://u:p@127.0.0.1:1/unused', { logging: false });
const RealSocialProfile = require('../../../src/models/SocialProfile')(sequelize, DataTypes);

const LONG_CATEGORY = ('fashion and lifestyle ' + 'x'.repeat(10) + ' ').repeat(10).slice(0, 250);
const LONG_AGE = 'late twenties to early thirties, depending on who asks'.padEnd(60, '!');

const generatedProfile = () => ({
  display_name: 'Glow Theory',
  follower_tier: 'mid',
  archetype: 'polished_curator',
  current_trajectory: 'rising',
  content_category: LONG_CATEGORY,
  age_range: LONG_AGE,
  engagement_rate: '4.2%',
});

const modelReply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

let db;
let app;
let existing;

function buildDb(rawAttributes = RealSocialProfile.rawAttributes) {
  existing = {
    id: 7,
    handle: '@glow_theory',
    platform: 'tiktok',
    vibe_sentence: 'Skincare chemist who films every failed batch.',
    feed_layer: 'real_world',
    is_justawoman_record: false,
    update: jest.fn().mockResolvedValue(undefined),
  };
  return {
    SocialProfile: {
      rawAttributes,
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(async (record) => ({ id: 42, ...record, update: jest.fn() })),
      findByPk: jest.fn().mockResolvedValue(existing),
    },
  };
}

function mount(dbToUse) {
  db = dbToUse;
  app = express();
  app.use(express.json());
  app.locals.db = db;
  app.use('/api/v1/social-profiles', router);
}

beforeEach(() => {
  mockCreate.mockReset();
  mount(buildDb());
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

const allLogs = (spy) => spy.mock.calls.map(args => args.map(String).join(' ')).join('\n');

const postGenerate = () => request(app)
  .post('/api/v1/social-profiles/generate')
  .set('x-test-user', '1')
  .send({ handle: 'glow_theory', platform: 'tiktok', vibe_sentence: 'Skincare chemist who films every failed batch.' });

const postRegenerate = () => request(app)
  .post('/api/v1/social-profiles/7/regenerate')
  .set('x-test-user', '1')
  .send({});

describe('model lengths', () => {
  it('declares the lengths the test relies on', () => {
    expect(RealSocialProfile.rawAttributes.content_category.type.options.length).toBe(100);
    expect(RealSocialProfile.rawAttributes.age_range.type.options.length).toBe(30);
  });
});

describe('POST /generate', () => {
  it('fits over-long generated strings to their columns and warns naming each field', async () => {
    mockCreate.mockResolvedValue(modelReply(generatedProfile()));

    const res = await postGenerate();

    expect(res.status).toBe(200);
    expect(db.SocialProfile.create).toHaveBeenCalledTimes(1);
    const record = db.SocialProfile.create.mock.calls[0][0];
    expect(record.content_category.length).toBeLessThanOrEqual(100);
    expect(record.age_range.length).toBeLessThanOrEqual(30);
    expect(record.content_category.length).toBeGreaterThan(0);
    expect(LONG_CATEGORY.startsWith(record.content_category)).toBe(true);
    expect(record.engagement_rate).toBe('4.2%');
    // full_profile (JSONB) keeps the untrimmed model output
    expect(record.full_profile.content_category).toBe(LONG_CATEGORY);

    const warns = console.warn.mock.calls.filter(a => String(a[0]).includes('truncated to column length'));
    expect(warns).toHaveLength(1);
    expect(warns[0][0]).toContain('content_category (250 > 100)');
    expect(warns[0][0]).toContain('age_range (60 > 30)');
    expect(warns[0][0]).not.toContain('fashion');
  });

  it('logs the over-length field when create() still fails with 22001', async () => {
    // Model declares content_category longer than the column (the mismatch case).
    const mismatched = { ...RealSocialProfile.rawAttributes, content_category: { type: DataTypes.STRING(300) } };
    mount(buildDb(mismatched));
    const err = new Error('value too long for type character varying(100)');
    err.original = { code: '22001' };
    db.SocialProfile.create.mockRejectedValue(err);
    mockCreate.mockResolvedValue(modelReply(generatedProfile()));

    const res = await postGenerate();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'value too long for type character varying(100)' });
    const line = console.error.mock.calls.map(a => String(a[0])).find(l => l.includes('22001'));
    expect(line).toBeDefined();
    expect(line).toContain('content_category 250/300');
    expect(line).toContain('does not match its column');
  });
});

describe('POST /:id/regenerate', () => {
  it('fits over-long generated strings in update() and warns naming each field', async () => {
    mockCreate.mockResolvedValue(modelReply(generatedProfile()));

    const res = await postRegenerate();

    expect(res.status).toBe(200);
    expect(existing.update).toHaveBeenCalledTimes(1);
    const record = existing.update.mock.calls[0][0];
    expect(record.content_category.length).toBeLessThanOrEqual(100);
    expect(record.age_range.length).toBeLessThanOrEqual(30);

    const warns = console.warn.mock.calls.filter(a => String(a[0]).includes('truncated to column length'));
    expect(warns).toHaveLength(1);
    expect(warns[0][0]).toContain('content_category (250 > 100)');
    expect(warns[0][0]).toContain('age_range (60 > 30)');
  });
});
