// ============================================================================
// Task #1851 — every path that writes generated (or generated-then-confirmed)
// fields into social_profiles fits strings to their declared column lengths
// and sanitizes enums through one shared helper (src/utils/fitToModel.js):
// bulk generateSingleProfile, /confirm-feed, feedScheduler and
// feedAutoGeneration. Mocked, no database, no AI call: the Anthropic SDK is a
// jest mock and the lengths come from the real SocialProfile model's
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
// socialProfileBulkRoutes reads its models from require('../models').
const mockModels = {};
jest.mock('../../../src/models', () => mockModels);

const fitToModel = require('../../../src/utils/fitToModel');
const bulkRouter = require('../../../src/routes/socialProfileBulkRoutes');
const charGenRouter = require('../../../src/routes/characterGenerationRoutes');
const feedScheduler = require('../../../src/services/feedScheduler');
const { autoCreateFeedProfile } = require('../../../src/services/feedAutoGeneration');

const sequelize = new Sequelize('postgres://u:p@127.0.0.1:1/unused', { logging: false });
const RealSocialProfile = require('../../../src/models/SocialProfile')(sequelize, DataTypes);

const LONG_NAME = ('Glow Theory Official ' + 'Skincare Lab ').repeat(12); // > 200
const LONG_ACTIVATION = 'the specific ache of watching someone else get there first '.repeat(5); // > 200
const LONG_COUNT = '~250K followers across TikTok, Instagram, YouTube and a very active Discord'; // > 50

const modelReply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
const truncWarns = () => console.warn.mock.calls
  .map(a => String(a[0]))
  .filter(l => l.includes('truncated to column length'));

function socialProfileModel() {
  return {
    rawAttributes: RealSocialProfile.rawAttributes,
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn(async (record) => ({ id: 42, ...record, update: jest.fn().mockResolvedValue(undefined) })),
    // The handle is free (Task #1893 guard on every write path).
    findOne: jest.fn().mockResolvedValue(null),
  };
}

const realSetTimeout = global.setTimeout;

beforeEach(() => {
  mockCreate.mockReset();
  // generateSingleProfile races the AI call against a 120s timer it never
  // clears; unref timers so they do not hold the Jest process open.
  jest.spyOn(global, 'setTimeout').mockImplementation((fn, ms, ...args) => {
    const t = realSetTimeout(fn, ms, ...args);
    if (t && typeof t.unref === 'function') t.unref();
    return t;
  });
  for (const k of Object.keys(mockModels)) delete mockModels[k];
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('shared helper', () => {
  it('declares the model lengths the tests rely on', () => {
    const limits = fitToModel.stringLengthLimits(RealSocialProfile);
    expect(limits).toMatchObject({
      handle: 100, display_name: 200, follower_count_approx: 50,
      emotional_activation: 200, content_category: 100, age_range: 30,
    });
  });

  it('asText coerces non-strings with String(...) and keeps falsy as null', () => {
    expect(fitToModel.asText(250000)).toBe('250000');
    expect(fitToModel.asText('mid')).toBe('mid');
    expect(fitToModel.asText('')).toBeNull();
    expect(fitToModel.asText(undefined)).toBeNull();
    expect(fitToModel.asText(0)).toBeNull();
  });
});

describe('bulk generateSingleProfile (POST /social-profiles/bulk/generate)', () => {
  function mountBulk() {
    const app = express();
    app.use(express.json());
    app.use('/bulk', bulkRouter);
    return app;
  }

  const postBulk = (app, creator) => request(app)
    .post('/bulk/generate')
    .set('x-test-user', '1')
    .send({ creators: [creator] });

  it('fits over-long fields in the create, warns by field name, and sanitizes enums', async () => {
    mockModels.SocialProfile = socialProfileModel();
    mockCreate.mockResolvedValue(modelReply({
      display_name: LONG_NAME,
      follower_count_approx: LONG_COUNT,
      emotional_activation: LONG_ACTIVATION,
      archetype: 'Totally Invented Archetype',
      current_trajectory: 'Viral Moment',
      lala_relevance_score: 6,
    }));

    const res = await postBulk(mountBulk(), { handle: 'glow_theory', platform: 'tiktok', vibe_sentence: 'Skincare chemist.' });

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ total: 1, succeeded: 1, failed: 0, skipped: 0 });
    // Task #1893: a plain create; the old findOrCreate reused and overwrote.
    const defaults = mockModels.SocialProfile.create.mock.calls[0][0];
    expect(defaults).toMatchObject({ handle: 'glow_theory', platform: 'tiktok' });
    expect(Array.from(defaults.display_name).length).toBeLessThanOrEqual(200);
    expect(LONG_NAME.startsWith(defaults.display_name)).toBe(true);
    expect(defaults.follower_count_approx.length).toBeLessThanOrEqual(50);
    expect(defaults.emotional_activation.length).toBeLessThanOrEqual(200);
    expect(defaults.archetype).toBe('polished_curator');
    expect(defaults.current_trajectory).toBe('viral_moment');
    // full_profile (JSONB) keeps the untrimmed model output
    expect(defaults.full_profile.display_name).toBe(LONG_NAME);

    const warns = truncWarns();
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain('bulk-generate');
    expect(warns[0]).toContain(`display_name (${LONG_NAME.length} > 200)`);
    expect(warns[0]).toContain(`follower_count_approx (${LONG_COUNT.length} > 50)`);
    expect(warns[0]).toContain(`emotional_activation (${LONG_ACTIVATION.length} > 200)`);
    expect(warns[0]).not.toContain('Skincare Lab');
  });

  it('never updates an existing row: a taken handle is skipped (Task #1893 removed the update path)', async () => {
    const existing = { id: 9, handle: 'glow_theory', deletedAt: null, update: jest.fn().mockResolvedValue(undefined) };
    mockModels.SocialProfile = socialProfileModel();
    mockModels.SocialProfile.findOne.mockResolvedValue(existing);
    mockCreate.mockResolvedValue(modelReply({ display_name: LONG_NAME, archetype: 'nonsense' }));

    const res = await postBulk(mountBulk(), { handle: 'glow_theory', platform: 'tiktok', vibe_sentence: 'x' });

    expect(res.status).toBe(200);
    expect(res.body.skipped).toHaveLength(1);
    expect(existing.update).not.toHaveBeenCalled();
    expect(mockModels.SocialProfile.create).not.toHaveBeenCalled();
  });

  it('names the over-length field when the write still fails with 22001', async () => {
    const mismatched = { ...RealSocialProfile.rawAttributes, display_name: { type: DataTypes.STRING(500) } };
    mockModels.SocialProfile = { ...socialProfileModel(), rawAttributes: mismatched };
    const err = new Error('value too long for type character varying(200)');
    err.original = { code: '22001' };
    mockModels.SocialProfile.create.mockRejectedValue(err);
    mockCreate.mockResolvedValue(modelReply({ display_name: LONG_NAME }));

    const res = await postBulk(mountBulk(), { handle: 'glow_theory', platform: 'tiktok', vibe_sentence: 'x' });

    expect(res.status).toBe(200);
    expect(res.body.summary.failed).toBe(1);
    const line = console.error.mock.calls.map(a => String(a[0])).find(l => l.includes('22001'));
    expect(line).toContain('bulk-generate');
    expect(line).toContain(`display_name ${LONG_NAME.length}/500`);
  });
});

describe('POST /character-generation/confirm-feed', () => {
  it('fits the confirmed proposal to its columns and warns by field name', async () => {
    const character = { id: 'c1', update: jest.fn().mockResolvedValue(undefined) };
    const SocialProfile = socialProfileModel();
    const app = express();
    app.use(express.json());
    app.set('models', { RegistryCharacter: { findByPk: jest.fn().mockResolvedValue(character) }, SocialProfile });
    app.use('/cg', charGenRouter);

    const longHandle = '@' + 'glow_theory_'.repeat(12); // > 100
    const res = await request(app)
      .post('/cg/confirm-feed')
      .set('x-test-user', '1')
      .send({ character_id: 'c1', feed_proposal: { handle: longHandle, display_name: LONG_NAME, platform: 'tiktok', follower_range: LONG_COUNT } });

    expect(res.status).toBe(201);
    const record = SocialProfile.create.mock.calls[0][0];
    expect(Array.from(record.handle).length).toBeLessThanOrEqual(100);
    expect(Array.from(record.display_name).length).toBeLessThanOrEqual(200);
    expect(record.follower_count_approx.length).toBeLessThanOrEqual(50);

    const warns = truncWarns();
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain('confirm-feed');
    expect(warns[0]).toContain(`handle (${longHandle.length} > 100)`);
    expect(warns[0]).toContain(`display_name (${LONG_NAME.length} > 200)`);
    expect(warns[0]).toContain(`follower_count_approx (${LONG_COUNT.length} > 50)`);
  });
});

describe('feedScheduler.generateAndSaveProfile', () => {
  const spark = { handle: 'glow_theory', platform: 'tiktok', vibe_sentence: 'Skincare chemist.' };

  it('accepts a numeric follower_count_approx without throwing and stores it as a string', async () => {
    const db = { SocialProfile: socialProfileModel() };
    mockCreate.mockResolvedValue(modelReply({ display_name: 'Glow Theory', follower_count_approx: 250000, archetype: 'soft_life' }));

    await expect(feedScheduler.generateAndSaveProfile(db, spark, 'real_world')).resolves.toBeDefined();

    const record = db.SocialProfile.create.mock.calls[0][0];
    expect(record.follower_count_approx).toBe('250000');
    expect(record.display_name).toBe('Glow Theory');
    expect(record.handle).toBe('@glow_theory');
    expect(record.content_category).toBeNull();
  });

  it('fits over-long fields to the same lengths as before and warns by field name', async () => {
    const db = { SocialProfile: socialProfileModel() };
    mockCreate.mockResolvedValue(modelReply({ display_name: LONG_NAME, emotional_activation: LONG_ACTIVATION, age_range: 'late twenties to early thirties, depends' }));

    await feedScheduler.generateAndSaveProfile(db, spark, 'real_world');

    const record = db.SocialProfile.create.mock.calls[0][0];
    expect(Array.from(record.display_name).length).toBeLessThanOrEqual(200);
    expect(record.emotional_activation.length).toBeLessThanOrEqual(200);
    expect(record.age_range.length).toBeLessThanOrEqual(30);
    const warns = truncWarns();
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain('feed-scheduler');
    expect(warns[0]).toContain(`display_name (${LONG_NAME.length} > 200)`);
    expect(warns[0]).toContain('age_range (');
  });
});

describe('feedAutoGeneration.autoCreateFeedProfile', () => {
  it('fits the registry display_name and warns by field name', async () => {
    const db = { SocialProfile: socialProfileModel() };
    const character = { id: 'c1', role_type: 'support', selected_name: LONG_NAME };

    const { feedProfile, skipped } = await autoCreateFeedProfile(db, character, 'real_world', { handle: '@glow' });

    expect(skipped).toBe(false);
    expect(feedProfile.id).toBe(42);
    const record = db.SocialProfile.create.mock.calls[0][0];
    expect(Array.from(record.display_name).length).toBeLessThanOrEqual(200);
    expect(LONG_NAME.startsWith(record.display_name)).toBe(true);
    const warns = truncWarns();
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain('feed-auto-generation');
    expect(warns[0]).toContain(`display_name (${LONG_NAME.length} > 200)`);
  });
});
