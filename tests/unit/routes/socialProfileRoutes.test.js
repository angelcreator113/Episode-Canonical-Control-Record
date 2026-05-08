// ============================================================================
// UNIT TESTS — socialProfileRoutes.js
// ============================================================================
// Tests for social profile CRUD, generation, templates, and route ordering.
// Run with: npm run test:unit
//
// Mocking strategy:
//   - Database models (SocialProfile, SocialProfileFollower, SocialProfileRelationship)
//     are injected via app.locals.db so the routes never touch a real database.
//   - The Anthropic SDK is mocked at the module level.
//   - Auth middleware is mocked to pass-through.

// Set dummy AWS credentials to prevent credential provider errors
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_REGION = 'us-east-1';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

// ── Module-level mocks ──────────────────────────────────────────────────────

jest.mock('@aws-sdk/credential-providers', () => ({
  fromIni: jest.fn(() => jest.fn().mockResolvedValue({ accessKeyId: 'test', secretAccessKey: 'test' })),
  fromEnv: jest.fn(() => jest.fn().mockResolvedValue({ accessKeyId: 'test', secretAccessKey: 'test' })),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  GetObjectCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

jest.mock('aws-sdk', () => ({
  CognitoIdentityServiceProvider: jest.fn(() => ({
    getSigningCertificate: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Certificate: 'test-cert' }),
    }),
  })),
  S3: jest.fn(() => ({
    getSignedUrl: jest.fn((op, params, cb) => cb(null, 'https://mock-s3-url')),
  })),
  SQS: jest.fn(() => ({
    sendMessage: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ MessageId: 'mock-id' }),
    }),
  })),
}));

// Mock Anthropic SDK
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

// F-AUTH-1 Step 3 CP8: socialProfileRoutes was promoted from optionalAuth (with
// lazy-noop fallback) to requireAuth. The pre-CP8 lazy-noop fallback implicitly
// bypassed auth in test runs; post-CP8 the real requireAuth fires and rejects
// anonymous requests with 401. Mock middleware/auth to set req.user and
// pass-through so handler-body assertions remain valid.
//
// optionalAuth is polymorphic: callable as middleware (req, res, next) OR as a
// factory `optionalAuth({ degradeOnInfraFailure: true })` returning middleware.
// Detection by arg shape — must match the F-Auth-3 polymorphic export.
jest.mock('../../../src/middleware/auth', () => {
  const passUser = (req, res, next) => {
    if (req && typeof req === 'object' && req.headers !== undefined && typeof next === 'function') {
      req.user = { id: 'test-user', email: 'test@test.com', source: 'local-hs256' };
      return next();
    }
    // Factory mode: returned a middleware
    return passUser;
  };
  return {
    requireAuth: passUser,
    optionalAuth: passUser,
    authenticate: passUser,
    authenticateToken: passUser,
    authorize: () => passUser,
    authorizeRole: () => passUser,
    verifyToken: jest.fn().mockResolvedValue({ sub: 'test-user', email: 'test@test.com' }),
    verifyGroup: () => passUser,
  };
});

jest.mock('../../../src/middleware/aiRateLimiter', () => ({
  aiRateLimiter: (req, res, next) => next(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const request = require('supertest');

/**
 * Build a mock db object with sensible defaults.
 * Individual tests can override specific methods.
 */
function buildMockDb(overrides = {}) {
  const defaultProfile = {
    id: 1,
    handle: '@testcreator',
    platform: 'instagram',
    vibe_sentence: 'Fashion-forward chaos',
    status: 'generated',
    display_name: 'Test Creator',
    full_profile: {},
    moment_log: [],
    sample_captions: [],
    feed_layer: 'real_world',
    is_justawoman_record: false,
    lala_relevance_score: 5,
    dataValues: {},
    update: jest.fn().mockImplementation(function (data) {
      Object.assign(this, data);
      return Promise.resolve(this);
    }),
    destroy: jest.fn().mockResolvedValue(),
  };

  return {
    SocialProfile: {
      findByPk: jest.fn().mockResolvedValue({ ...defaultProfile }),
      findOne: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
      findAndCountAll: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((data) =>
        Promise.resolve({ id: 1, ...data, dataValues: data }),
      ),
      update: jest.fn().mockResolvedValue([1]),
      destroy: jest.fn().mockResolvedValue(1),
      ...overrides.SocialProfile,
    },
    SocialProfileFollower: {
      findAll: jest.fn().mockResolvedValue([]),
      findOrCreate: jest.fn().mockResolvedValue([{ id: 1 }, true]),
      count: jest.fn().mockResolvedValue(0),
      destroy: jest.fn().mockResolvedValue(1),
      ...overrides.SocialProfileFollower,
    },
    SocialProfileRelationship: {
      findOrCreate: jest.fn().mockResolvedValue([{ id: 1 }, true]),
      findAll: jest.fn().mockResolvedValue([]),
      ...overrides.SocialProfileRelationship,
    },
    sequelize: {
      fn: jest.fn((name, col) => `${name}(${col})`),
      col: jest.fn((name) => name),
      literal: jest.fn((s) => s),
    },
    ...overrides,
  };
}

/**
 * Return a fresh Express app with the social profile router mounted
 * and the given mock db injected.
 */
function createTestApp(mockDb) {
  // We require the real app and inject db — but the routes file imports
  // the Anthropic client at module level, which is already mocked above.
  const app = require('../../../src/app');
  app.locals.db = mockDb;
  return app;
}

// ── Test suites ─────────────────────────────────────────────────────────────

describe('Social Profile Routes', () => {
  let app;
  let mockDb;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = buildMockDb();
    app = createTestApp(mockDb);
  });

  // ════════════════════════════════════════════════════════════════════════
  // 1. GET / — list profiles
  // ════════════════════════════════════════════════════════════════════════
  describe('GET /api/v1/social-profiles/', () => {
    it('should return paginated profiles with defaults', async () => {
      mockDb.SocialProfile.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: [{ id: 1, handle: '@a' }, { id: 2, handle: '@b' }],
      });
      mockDb.SocialProfile.findAll.mockResolvedValue([
        { status: 'generated', count: '2' },
      ]);

      const res = await request(app).get('/api/v1/social-profiles/');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('profiles');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination).toMatchObject({ page: 1 });
    });

    it('should pass page and limit to query', async () => {
      mockDb.SocialProfile.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      mockDb.SocialProfile.findAll.mockResolvedValue([]);

      await request(app).get('/api/v1/social-profiles/?page=2&limit=10');

      const call = mockDb.SocialProfile.findAndCountAll.mock.calls[0][0];
      expect(call.limit).toBe(10);
      expect(call.offset).toBe(10); // (page 2 - 1) * 10
    });

    it('should filter by status', async () => {
      mockDb.SocialProfile.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      mockDb.SocialProfile.findAll.mockResolvedValue([]);

      await request(app).get('/api/v1/social-profiles/?status=finalized');

      const call = mockDb.SocialProfile.findAndCountAll.mock.calls[0][0];
      expect(call.where.status).toBe('finalized');
    });

    it('should filter by feed_layer', async () => {
      mockDb.SocialProfile.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      mockDb.SocialProfile.findAll.mockResolvedValue([]);

      await request(app).get('/api/v1/social-profiles/?feed_layer=real_world');

      const call = mockDb.SocialProfile.findAndCountAll.mock.calls[0][0];
      expect(call.where.feed_layer).toBe('real_world');
    });

    it('should apply search across handle and display_name', async () => {
      mockDb.SocialProfile.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      mockDb.SocialProfile.findAll.mockResolvedValue([]);

      await request(app).get('/api/v1/social-profiles/?search=fashionista');

      const call = mockDb.SocialProfile.findAndCountAll.mock.calls[0][0];
      // Search creates an Op.and condition array
      expect(call.where).toBeDefined();
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 2. POST /generate — AI profile generation
  // ════════════════════════════════════════════════════════════════════════
  describe('POST /api/v1/social-profiles/generate', () => {
    const validBody = {
      handle: '@testcreator',
      platform: 'instagram',
      vibe_sentence: 'Chaotic fashion energy with soft life aspirations',
    };

    it('should return 400 when handle is missing', async () => {
      const res = await request(app)
        .post('/api/v1/social-profiles/generate')
        .send({ platform: 'instagram', vibe_sentence: 'test' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/handle/i);
    });

    it('should return 400 when vibe_sentence is missing', async () => {
      const res = await request(app)
        .post('/api/v1/social-profiles/generate')
        .send({ handle: '@test', platform: 'instagram' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/vibe_sentence/i);
    });

    it('should return 400 when platform is missing', async () => {
      const res = await request(app)
        .post('/api/v1/social-profiles/generate')
        .send({ handle: '@test', vibe_sentence: 'test' });

      expect(res.status).toBe(400);
    });

    it('should call Anthropic with claude-sonnet-4-6 model', async () => {
      const generatedProfile = {
        display_name: 'Test Creator',
        follower_tier: 'mid',
        archetype: 'polished_curator',
        current_trajectory: 'rising',
        content_category: 'fashion',
        follower_count_approx: '45k',
        content_persona: 'Curated perfection',
        real_signal: 'Insecurity leaks through',
        posting_voice: 'Short sentences. Lots of periods.',
        comment_energy: 'Supportive besties',
        parasocial_function: 'Mirror',
        emotional_activation: 'Envy',
        watch_reason: 'Cannot stop',
        what_it_costs_her: 'Time',
        trajectory_detail: 'On the way up',
        moment_log: [],
        sample_captions: ['caption 1'],
        sample_comments: ['comment 1'],
        pinned_post: 'pinned',
        lala_relevance_score: 7,
        lala_relevance_reason: 'Mirror effect',
        book_relevance: ['Relevant'],
        world_exists: false,
        crossing_trigger: 'DM',
        crossing_mechanism: 'Comment section',
        adult_content_present: false,
      };

      mockCreate.mockResolvedValue({
        content: [{ text: JSON.stringify(generatedProfile) }],
      });

      // Make SocialProfile.findByPk return the created profile for the reload step
      const createdProfile = { id: 1, ...generatedProfile, handle: '@testcreator', platform: 'instagram' };
      mockDb.SocialProfile.create.mockResolvedValue({ id: 1, dataValues: {} });
      mockDb.SocialProfile.findByPk.mockResolvedValue(createdProfile);

      const res = await request(app)
        .post('/api/v1/social-profiles/generate')
        .send(validBody);

      expect(res.status).toBe(200);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      const anthropicCall = mockCreate.mock.calls[0][0];
      expect(anthropicCall.model).toBe('claude-sonnet-4-6');
      expect(anthropicCall.max_tokens).toBe(6000);
      expect(anthropicCall.messages[0].role).toBe('user');
    });

    it('should return 500 when AI returns empty response', async () => {
      mockCreate.mockResolvedValue({ content: [{ text: '' }] });

      const res = await request(app)
        .post('/api/v1/social-profiles/generate')
        .send(validBody);

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/empty/i);
    });

    it('should return 500 when AI returns unparseable JSON', async () => {
      mockCreate.mockResolvedValue({ content: [{ text: 'not valid json {{{{' }] });

      const res = await request(app)
        .post('/api/v1/social-profiles/generate')
        .send(validBody);

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/parse/i);
    });

    it('should require city for lalaverse feed_layer', async () => {
      const res = await request(app)
        .post('/api/v1/social-profiles/generate')
        .send({ ...validBody, feed_layer: 'lalaverse' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/city/i);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 3. GET /:id — single profile
  // ════════════════════════════════════════════════════════════════════════
  describe('GET /api/v1/social-profiles/:id', () => {
    it('should return 404 when profile not found', async () => {
      mockDb.SocialProfile.findByPk.mockResolvedValue(null);

      const res = await request(app).get('/api/v1/social-profiles/999');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('should return the profile when found', async () => {
      const profile = { id: 1, handle: '@test', platform: 'instagram' };
      mockDb.SocialProfile.findByPk.mockResolvedValue(profile);

      const res = await request(app).get('/api/v1/social-profiles/1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('profile');
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 4. PUT /:id — full update with allowed fields whitelist
  // ════════════════════════════════════════════════════════════════════════
  describe('PUT /api/v1/social-profiles/:id', () => {
    it('should only apply allowed fields', async () => {
      const mockProfile = {
        id: 1,
        handle: '@old',
        is_justawoman_record: false,
        update: jest.fn().mockResolvedValue(),
      };
      mockDb.SocialProfile.findByPk.mockResolvedValue(mockProfile);

      const res = await request(app)
        .put('/api/v1/social-profiles/1')
        .send({
          handle: '@newhdle',
          display_name: 'New Name',
          // These should NOT be applied (not in allowed list)
          generation_model: 'hacked-model',
          full_profile: { evil: true },
          id: 999,
        });

      expect(res.status).toBe(200);
      const updateArg = mockProfile.update.mock.calls[0][0];
      expect(updateArg.handle).toBe('@newhdle');
      expect(updateArg.display_name).toBe('New Name');
      // Fields not in the allowed list should be excluded
      expect(updateArg.generation_model).toBeUndefined();
      expect(updateArg.full_profile).toBeUndefined();
      expect(updateArg.id).toBeUndefined();
    });

    it('should return 404 when profile not found', async () => {
      mockDb.SocialProfile.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/v1/social-profiles/999')
        .send({ handle: '@test' });

      expect(res.status).toBe(404);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 5. PATCH /:id — partial update
  // ════════════════════════════════════════════════════════════════════════
  describe('PATCH /api/v1/social-profiles/:id', () => {
    it('should apply partial updates', async () => {
      const mockProfile = {
        id: 1,
        handle: '@existing',
        display_name: 'Old Name',
        is_justawoman_record: false,
        update: jest.fn().mockResolvedValue(),
      };
      mockDb.SocialProfile.findByPk.mockResolvedValue(mockProfile);

      const res = await request(app)
        .patch('/api/v1/social-profiles/1')
        .send({ display_name: 'Updated Name' });

      expect(res.status).toBe(200);
      const updateArg = mockProfile.update.mock.calls[0][0];
      expect(updateArg.display_name).toBe('Updated Name');
      // Fields not sent should not appear in the update
      expect(updateArg.handle).toBeUndefined();
    });

    it('should return 404 when profile not found', async () => {
      mockDb.SocialProfile.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/v1/social-profiles/999')
        .send({ display_name: 'test' });

      expect(res.status).toBe(404);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 6. POST /:id/finalize — status change
  // ════════════════════════════════════════════════════════════════════════
  describe('POST /api/v1/social-profiles/:id/finalize', () => {
    it('should finalize a profile', async () => {
      const mockProfile = {
        id: 1,
        status: 'generated',
        is_justawoman_record: false,
        update: jest.fn().mockResolvedValue(),
      };
      mockDb.SocialProfile.findByPk.mockResolvedValue(mockProfile);

      const res = await request(app)
        .post('/api/v1/social-profiles/1/finalize');

      expect(res.status).toBe(200);
      expect(mockProfile.update).toHaveBeenCalledWith({ status: 'finalized' });
    });

    it('should return 404 when profile not found', async () => {
      mockDb.SocialProfile.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/social-profiles/999/finalize');

      expect(res.status).toBe(404);
    });

    it('should block finalization of JustAWoman record', async () => {
      const mockProfile = {
        id: 1,
        is_justawoman_record: true,
        update: jest.fn(),
      };
      mockDb.SocialProfile.findByPk.mockResolvedValue(mockProfile);

      const res = await request(app)
        .post('/api/v1/social-profiles/1/finalize');

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/locked/i);
      expect(mockProfile.update).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 7. POST /:id/add-moment — validation
  // ════════════════════════════════════════════════════════════════════════
  describe('POST /api/v1/social-profiles/:id/add-moment', () => {
    it('should return 400 when moment object is missing', async () => {
      const mockProfile = { id: 1, moment_log: [] };
      mockDb.SocialProfile.findByPk.mockResolvedValue(mockProfile);

      const res = await request(app)
        .post('/api/v1/social-profiles/1/add-moment')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/moment/i);
    });

    it('should return 400 when moment is not an object', async () => {
      const mockProfile = { id: 1, moment_log: [] };
      mockDb.SocialProfile.findByPk.mockResolvedValue(mockProfile);

      const res = await request(app)
        .post('/api/v1/social-profiles/1/add-moment')
        .send({ moment: 'just a string' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/moment/i);
    });

    it('should append a moment to the moment log', async () => {
      const mockProfile = {
        id: 1,
        moment_log: [{ moment_type: 'post', description: 'existing' }],
        update: jest.fn().mockResolvedValue(),
      };
      mockDb.SocialProfile.findByPk.mockResolvedValue(mockProfile);

      const newMoment = { moment_type: 'live', description: 'went live crying' };
      const res = await request(app)
        .post('/api/v1/social-profiles/1/add-moment')
        .send({ moment: newMoment });

      expect(res.status).toBe(200);
      const updateArg = mockProfile.update.mock.calls[0][0];
      expect(updateArg.moment_log).toHaveLength(2);
      expect(updateArg.moment_log[1]).toEqual(newMoment);
    });

    it('should return 404 when profile not found', async () => {
      mockDb.SocialProfile.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/social-profiles/999/add-moment')
        .send({ moment: { moment_type: 'post' } });

      expect(res.status).toBe(404);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 8. GET /templates — returns array
  // ════════════════════════════════════════════════════════════════════════
  describe('GET /api/v1/social-profiles/templates', () => {
    it('should return a templates array', async () => {
      const res = await request(app).get('/api/v1/social-profiles/templates');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('templates');
      expect(Array.isArray(res.body.templates)).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 9. sanitizeEnum function — normalization and fallback
  // ════════════════════════════════════════════════════════════════════════
  describe('sanitizeEnum', () => {
    // Import the function indirectly by requiring the module's internals.
    // Since sanitizeEnum is not exported, we test it through the generation
    // endpoint behavior. However, we can also test the pattern directly
    // by reimplementing the same logic to validate expectations.

    // The route file does not export sanitizeEnum directly, so we test
    // its behavior through the generate endpoint's handling of AI output.

    // We can verify the enum sanitization by checking that weird AI output
    // values are normalized correctly in the saved profile.

    it('should normalize AI-generated follower tier with spaces/hyphens', async () => {
      const generatedProfile = {
        display_name: 'Test',
        follower_tier: 'Mid Tier', // AI might return this instead of 'mid'
        archetype: 'Polished Curator', // spaces instead of underscore
        current_trajectory: 'Rising Star', // extra word
        content_category: 'fashion',
        content_persona: 'test',
        real_signal: 'test',
      };

      mockCreate.mockResolvedValue({
        content: [{ text: JSON.stringify(generatedProfile) }],
      });
      mockDb.SocialProfile.create.mockResolvedValue({ id: 1, dataValues: {} });
      mockDb.SocialProfile.findByPk.mockResolvedValue({ id: 1, handle: '@test' });

      await request(app)
        .post('/api/v1/social-profiles/generate')
        .send({ handle: '@test', platform: 'tiktok', vibe_sentence: 'chaotic' });

      const createCall = mockDb.SocialProfile.create.mock.calls[0][0];
      // sanitizeEnum should normalize 'Mid Tier' -> 'mid_tier' -> partial match 'mid'
      expect(['micro', 'mid', 'macro', 'mega']).toContain(createCall.follower_tier);
      // 'Polished Curator' -> 'polished_curator'
      expect(createCall.archetype).toBe('polished_curator');
    });

    it('should fall back to default when value is completely invalid', async () => {
      const generatedProfile = {
        display_name: 'Test',
        follower_tier: 'zzz_nonexistent',
        archetype: 'zzz_nonexistent',
        current_trajectory: 'zzz_nonexistent',
        content_category: 'fashion',
        content_persona: 'test',
        real_signal: 'test',
      };

      mockCreate.mockResolvedValue({
        content: [{ text: JSON.stringify(generatedProfile) }],
      });
      mockDb.SocialProfile.create.mockResolvedValue({ id: 1, dataValues: {} });
      mockDb.SocialProfile.findByPk.mockResolvedValue({ id: 1, handle: '@test' });

      await request(app)
        .post('/api/v1/social-profiles/generate')
        .send({ handle: '@test', platform: 'tiktok', vibe_sentence: 'test' });

      const createCall = mockDb.SocialProfile.create.mock.calls[0][0];
      // Fallback values
      expect(createCall.follower_tier).toBe('mid');
      expect(createCall.archetype).toBe('polished_curator');
      expect(createCall.current_trajectory).toBe('rising');
    });

    it('should handle null/undefined enum values by using fallback', async () => {
      const generatedProfile = {
        display_name: 'Test',
        // follower_tier, archetype, current_trajectory all missing
        content_category: 'fashion',
        content_persona: 'test',
        real_signal: 'test',
      };

      mockCreate.mockResolvedValue({
        content: [{ text: JSON.stringify(generatedProfile) }],
      });
      mockDb.SocialProfile.create.mockResolvedValue({ id: 1, dataValues: {} });
      mockDb.SocialProfile.findByPk.mockResolvedValue({ id: 1, handle: '@test' });

      await request(app)
        .post('/api/v1/social-profiles/generate')
        .send({ handle: '@test', platform: 'tiktok', vibe_sentence: 'test' });

      const createCall = mockDb.SocialProfile.create.mock.calls[0][0];
      expect(createCall.follower_tier).toBe('mid');
      expect(createCall.archetype).toBe('polished_curator');
      expect(createCall.current_trajectory).toBe('rising');
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 10. Route ordering — named routes not shadowed by /:id
  // ════════════════════════════════════════════════════════════════════════
  describe('Route ordering', () => {
    it('GET /templates should be reachable (not captured by /:id)', async () => {
      const res = await request(app).get('/api/v1/social-profiles/templates');

      // If /:id captured this, we would get a 404 (no profile with id "templates")
      // or a 500 from trying to look up a non-numeric id.
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('templates');
    });

    it('GET /network should be reachable (not captured by /:id)', async () => {
      // The network route queries SocialProfileRelationship
      mockDb.SocialProfileRelationship.findAll.mockResolvedValue([]);

      const res = await request(app).get('/api/v1/social-profiles/network');

      // Should get 200 from the /network handler, not a 404/500 from /:id
      expect(res.status).toBe(200);
    });

    it('GET /export should be reachable (not captured by /:id)', async () => {
      mockDb.SocialProfile.findAll.mockResolvedValue([]);

      const res = await request(app).get('/api/v1/social-profiles/export');

      expect(res.status).toBe(200);
    });
  });
});
