// ============================================================================
// Task #1893 — every path that creates or renames a social profile refuses a
// taken handle, with the Task #1886 semantics: case-insensitive, `@x` = `x`,
// and a soft-deleted holder counts as taken.
//
//   bulk generate        generateSingleProfile  → skipped, reported, never update()
//   /confirm-feed        characterGenerationRoutes → 409
//   feed scheduler       generateAndSaveProfile → skipped (null), logged
//   feed auto-generation autoCreateFeedProfile  → skipped, logged
//   PUT / PATCH /:id     socialProfileRoutes    → 409 (own id excluded)
//
// Mocked, no database, no AI call. The SocialProfile is an in-memory fake
// (tests/unit/helpers/fakeSocialProfileHandles.js) that evaluates the WHERE
// the code builds — ILIKE, Op.or, Op.ne, paranoid — over fixture rows, so a
// lookup that misses a case or @ variant, or skips soft-deleted rows, misses
// here too. Every collision test asserts the pre-existing row is untouched.
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

const { fakeSocialProfile } = require('../helpers/fakeSocialProfileHandles');
const bulkRouter = require('../../../src/routes/socialProfileBulkRoutes');
const { generateSingleProfile } = require('../../../src/routes/socialProfileBulkRoutes');
const charGenRouter = require('../../../src/routes/characterGenerationRoutes');
const profileRouter = require('../../../src/routes/socialProfileRoutes');
const feedScheduler = require('../../../src/services/feedScheduler');
const { autoCreateFeedProfile } = require('../../../src/services/feedAutoGeneration');

const sequelize = new Sequelize('postgres://u:p@127.0.0.1:1/unused', { logging: false });
const RealSocialProfile = require('../../../src/models/SocialProfile')(sequelize, DataTypes);
const rawAttributes = RealSocialProfile.rawAttributes;

const modelReply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
const GENERATED = { display_name: 'Studio By Sable', archetype: 'polished_curator', lala_relevance_score: 4 };

// The holder already in the table, and the three collisions each path must
// refuse. `row` is the fixture; `attempt` is the handle the path tries.
const LIVE = { id: 12, handle: '@StudioBySable', platform: 'instagram', display_name: 'The Original', vibe_sentence: 'the one we already have', feed_layer: 'real_world', deletedAt: null };
const DELETED = { ...LIVE, id: 7, handle: 'glow_theory', platform: 'tiktok', display_name: 'Deleted Glow', deletedAt: '2026-09-20T00:00:00.000Z' };
const COLLISIONS = [
  ['case variant', LIVE, '@studiobysable', 'instagram'],
  ['@ variant', LIVE, 'StudioBySable', 'instagram'],
  ['soft-deleted holder', DELETED, '@GLOW_THEORY', 'tiktok'],
];

let restoreTimeout;
beforeEach(() => {
  mockCreate.mockReset();
  mockCreate.mockResolvedValue(modelReply(GENERATED));
  for (const k of Object.keys(mockModels)) delete mockModels[k];
  // generateSingleProfile races the model call against a 120s timer; unref
  // any that are still pending so they cannot hold the Jest process open.
  const realSetTimeout = global.setTimeout;
  restoreTimeout = jest.spyOn(global, 'setTimeout').mockImplementation((fn, ms, ...args) => {
    const t = realSetTimeout(fn, ms, ...args);
    if (t && typeof t.unref === 'function') t.unref();
    return t;
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  if (restoreTimeout) restoreTimeout.mockRestore();
  jest.restoreAllMocks();
});

const warned = () => console.warn.mock.calls.map((a) => a.map(String).join(' ')).join('\n');

// ── 1. Bulk generate ─────────────────────────────────────────────────────────
describe('bulk generate (POST /social-profiles/bulk/generate) — Task #1893', () => {
  function mountBulk() {
    const app = express();
    app.use(express.json());
    app.use('/bulk', bulkRouter);
    return app;
  }
  const postBulk = (creators) => request(mountBulk()).post('/bulk/generate').set('x-test-user', '1').send({ creators });

  it.each(COLLISIONS)('skips a %s before the model call, reports it, and never updates the existing row', async (_label, row, handle, platform) => {
    const SocialProfile = fakeSocialProfile([row], { rawAttributes });
    mockModels.SocialProfile = SocialProfile;

    const res = await postBulk([{ handle, platform, vibe_sentence: 'a different creator entirely' }]);

    expect(res.status).toBe(200);
    expect(res.body.skipped).toEqual([{ handle, reason: expect.stringContaining(`(id ${row.id})`) }]);
    expect(res.body.results[0]).toMatchObject({ handle, status: 'skipped' });
    expect(res.body.summary).toMatchObject({ total: 1, succeeded: 0, failed: 0, skipped: 1 });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(SocialProfile.create).not.toHaveBeenCalled();
    expect(SocialProfile.rows[0].update).not.toHaveBeenCalled();
    expect(SocialProfile.untouched()).toBe(true);
    expect(SocialProfile.rows).toHaveLength(1);
  });

  it('an exact (handle, platform) match is skipped too — the old findOrCreate overwrite is gone', async () => {
    const SocialProfile = fakeSocialProfile([LIVE], { rawAttributes });
    mockModels.SocialProfile = SocialProfile;

    const res = await postBulk([{ handle: LIVE.handle, platform: LIVE.platform, vibe_sentence: 'retry of the same batch' }]);

    // Asserted first: on main this is the overwrite (findOrCreate → !created → update).
    expect(SocialProfile.rows[0].update).not.toHaveBeenCalled();
    expect(SocialProfile.untouched()).toBe(true);
    expect(res.body.skipped).toEqual([{ handle: LIVE.handle, reason: `${LIVE.handle} is already taken by an existing creator (id 12) — pick another handle.` }]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('re-checks before the save: a holder that appears during the model call is skipped, no write', async () => {
    const SocialProfile = fakeSocialProfile([], { rawAttributes });
    mockModels.SocialProfile = SocialProfile;
    // Another path takes the handle while the model is generating.
    mockCreate.mockImplementation(async () => {
      SocialProfile.rows.push({ id: 99, handle: '@late_arrival', platform: 'tiktok', deletedAt: null, update: jest.fn() });
      return modelReply(GENERATED);
    });

    const res = await postBulk([{ handle: 'Late_Arrival', platform: 'tiktok', vibe_sentence: 'x' }]);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(res.body.skipped).toEqual([{ handle: 'Late_Arrival', reason: expect.stringContaining('(id 99)') }]);
    expect(SocialProfile.create).not.toHaveBeenCalled();
    expect(SocialProfile.rows[0].update).not.toHaveBeenCalled();
    expect(warned()).toContain('before save');
  });

  it('two items in one batch with the same handle: the first is created, the later one skipped', async () => {
    const SocialProfile = fakeSocialProfile([], { rawAttributes });
    mockModels.SocialProfile = SocialProfile;

    const res = await postBulk([
      { handle: 'NewFace', platform: 'tiktok', vibe_sentence: 'a' },
      { handle: '@newface', platform: 'instagram', vibe_sentence: 'b' },
    ]);

    expect(res.body.summary).toMatchObject({ total: 2, succeeded: 1, skipped: 1 });
    expect(res.body.skipped).toEqual([{ handle: '@newface', reason: expect.stringContaining('earlier in this batch') }]);
    expect(SocialProfile.create).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('a free handle is generated and created with a plain create (no findOrCreate)', async () => {
    const SocialProfile = fakeSocialProfile([LIVE], { rawAttributes });
    mockModels.SocialProfile = SocialProfile;

    const result = await generateSingleProfile(
      { handle: 'brand_new', platform: 'tiktok', vibe_sentence: 'x' },
      { db: mockModels, seriesId: null, characterContext: null },
    );

    expect(result).toMatchObject({ status: 'success', handle: 'brand_new' });
    expect(SocialProfile.create).toHaveBeenCalledTimes(1);
    expect(SocialProfile.create.mock.calls[0][0]).toMatchObject({ handle: 'brand_new', platform: 'tiktok' });
    expect(SocialProfile.findOrCreate).not.toHaveBeenCalled();
    expect(SocialProfile.untouched()).toBe(true);
  });
});

// ── 2. /confirm-feed ─────────────────────────────────────────────────────────
describe('POST /character-generation/confirm-feed — Task #1893', () => {
  function mountCharGen(SocialProfile, character) {
    const app = express();
    app.use(express.json());
    app.set('models', { RegistryCharacter: { findByPk: jest.fn().mockResolvedValue(character) }, SocialProfile });
    app.use('/cg', charGenRouter);
    return app;
  }

  it.each(COLLISIONS)('refuses a %s with 409, writes nothing, and leaves the character unlinked', async (_label, row, handle, platform) => {
    const SocialProfile = fakeSocialProfile([row], { rawAttributes });
    const character = { id: 'c1', update: jest.fn().mockResolvedValue(undefined) };

    const res = await request(mountCharGen(SocialProfile, character))
      .post('/cg/confirm-feed')
      .set('x-test-user', '1')
      .send({ character_id: 'c1', feed_proposal: { handle, platform, display_name: 'New Person' } });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ handleTaken: true, holder: { id: row.id, deleted: !!row.deletedAt } });
    expect(res.body.error).toContain(`(id ${row.id})`);
    expect(SocialProfile.create).not.toHaveBeenCalled();
    expect(character.update).not.toHaveBeenCalled();
    expect(SocialProfile.untouched()).toBe(true);
  });

  it('a free handle is still created (201)', async () => {
    const SocialProfile = fakeSocialProfile([LIVE], { rawAttributes });
    const character = { id: 'c1', update: jest.fn().mockResolvedValue(undefined) };

    const res = await request(mountCharGen(SocialProfile, character))
      .post('/cg/confirm-feed')
      .set('x-test-user', '1')
      .send({ character_id: 'c1', feed_proposal: { handle: '@someone_new', platform: 'tiktok' } });

    expect(res.status).toBe(201);
    expect(SocialProfile.create).toHaveBeenCalledTimes(1);
    expect(SocialProfile.untouched()).toBe(true);
  });
});

// ── 3. Feed scheduler ────────────────────────────────────────────────────────
describe('feedScheduler.generateAndSaveProfile — Task #1893', () => {
  it.each(COLLISIONS)('skips a %s before the model call, logs it, and does not throw', async (_label, row, handle, platform) => {
    const SocialProfile = fakeSocialProfile([row], { rawAttributes });
    const db = { SocialProfile };

    await expect(feedScheduler.generateAndSaveProfile(db, { handle, platform, vibe_sentence: 'x' }, 'real_world')).resolves.toBeNull();

    expect(mockCreate).not.toHaveBeenCalled();
    expect(SocialProfile.create).not.toHaveBeenCalled();
    expect(SocialProfile.untouched()).toBe(true);
    expect(warned()).toContain(`(id ${row.id})`);
  });

  it('autoGenerateBatch reports a taken spark as skipped, not as an error, and keeps going', async () => {
    const SocialProfile = fakeSocialProfile([LIVE], { rawAttributes });
    SocialProfile.findAll = jest.fn().mockResolvedValue([]);
    const db = { SocialProfile };
    // First model call: the sparks. The first spark collides; the second is free.
    mockCreate
      .mockResolvedValueOnce({ content: [{ type: 'text', text: JSON.stringify([
        { handle: '@studiobysable', platform: 'instagram', vibe_sentence: 'collides' },
        { handle: '@fresh_face', platform: 'tiktok', vibe_sentence: 'free' },
      ]) }] })
      .mockResolvedValue(modelReply(GENERATED));

    const result = await feedScheduler.autoGenerateBatch(db, 'real_world', 2);

    expect(result.skipped).toEqual([{ handle: '@studiobysable', reason: 'handle taken' }]);
    expect(result.errors).toEqual([]);
    expect(result.created.map((p) => p.handle)).toEqual(['@fresh_face']);
    expect(SocialProfile.untouched()).toBe(true);
  });
});

// ── 4. Feed auto-generation ──────────────────────────────────────────────────
describe('feedAutoGeneration.autoCreateFeedProfile — Task #1893', () => {
  it.each(COLLISIONS)('skips a %s and logs it', async (_label, row, handle, platform) => {
    const SocialProfile = fakeSocialProfile([row], { rawAttributes });
    const db = { SocialProfile };
    const character = { id: 'c9', role_type: 'support', selected_name: 'New Person' };

    const result = await autoCreateFeedProfile(db, character, 'real_world', { handle, platform });

    expect(result).toMatchObject({ feedProfile: null, skipped: true, reason: 'handle_taken', holder_id: row.id });
    expect(SocialProfile.create).not.toHaveBeenCalled();
    expect(SocialProfile.untouched()).toBe(true);
    expect(warned()).toContain(`(id ${row.id})`);
  });
});

// ── 5. PUT / PATCH /:id renames ─────────────────────────────────────────────
describe('PUT and PATCH /social-profiles/:id renames — Task #1893', () => {
  const SELF = { id: 30, handle: '@my_own_handle', platform: 'tiktok', is_justawoman_record: false, deletedAt: null };

  function mountProfiles(SocialProfile) {
    const app = express();
    app.use(express.json());
    app.locals.db = { SocialProfile };
    app.use('/sp', profileRouter);
    return app;
  }

  for (const verb of ['put', 'patch']) {
    it.each(COLLISIONS)(`${verb.toUpperCase()} refuses a rename onto a %s with 409 and writes neither row`, async (_label, row, handle) => {
      const SocialProfile = fakeSocialProfile([row, SELF], { rawAttributes });

      const res = await request(mountProfiles(SocialProfile))[verb]('/sp/30').set('x-test-user', '1').send({ handle, display_name: 'Renamed' });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ handleTaken: true, holder: { id: row.id, deleted: !!row.deletedAt } });
      expect(res.body.error).toContain(`(id ${row.id})`);
      expect(SocialProfile.untouched()).toBe(true);
    });

    it.each([
      ['the same handle', '@my_own_handle'],
      ['only its case changed', '@My_Own_Handle'],
      ['only its @ dropped', 'my_own_handle'],
    ])(`${verb.toUpperCase()} accepts %s (the profile's own id is excluded)`, async (_label, handle) => {
      const SocialProfile = fakeSocialProfile([LIVE, SELF], { rawAttributes });

      const res = await request(mountProfiles(SocialProfile))[verb]('/sp/30').set('x-test-user', '1').send({ handle });

      expect(res.status).toBe(200);
      expect(SocialProfile.rows[1].update).toHaveBeenCalledWith(expect.objectContaining({ handle }));
      expect(SocialProfile.rows[0].update).not.toHaveBeenCalled();
    });

    it(`${verb.toUpperCase()} refuses an empty or non-string handle with 400 before any lookup`, async () => {
      const SocialProfile = fakeSocialProfile([LIVE, SELF], { rawAttributes });
      const app = mountProfiles(SocialProfile);

      const empty = await request(app)[verb]('/sp/30').set('x-test-user', '1').send({ handle: '  ' });
      const notString = await request(app)[verb]('/sp/30').set('x-test-user', '1').send({ handle: ['@a'] });

      expect(empty.status).toBe(400);
      expect(notString.status).toBe(400);
      expect(SocialProfile.findOne).not.toHaveBeenCalled();
      expect(SocialProfile.untouched()).toBe(true);
    });

    it(`${verb.toUpperCase()} without a handle skips the lookup`, async () => {
      const SocialProfile = fakeSocialProfile([LIVE, SELF], { rawAttributes });

      const res = await request(mountProfiles(SocialProfile))[verb]('/sp/30').set('x-test-user', '1').send({ display_name: 'Just a name' });

      expect(res.status).toBe(200);
      expect(SocialProfile.findOne).not.toHaveBeenCalled();
    });
  }
});
