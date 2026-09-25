// ============================================================================
// POST /api/v1/social-profiles/autofill-draft (Task #1828). Mocked, no
// database, no AI call: the Anthropic SDK is replaced by a jest mock, and the
// route is mounted alone. Requests without x-test-user go through the real
// requireAuth, so the 401 case exercises production middleware.
// ============================================================================

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-anthropic-key';

const express = require('express');
const request = require('supertest');

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

const ALLOWED = {
  platforms: ['instagram', 'tiktok', 'youtube'],
  cities: ['dazzle_district', 'radiance_row'],
  relationships: ['mutual_unaware', 'one_sided'],
  careerPressures: ['ahead', 'level'],
};

function buildDb() {
  return {
    SocialProfile: {
      rawAttributes: { platform: { values: ['tiktok', 'instagram', 'youtube', 'twitter'] } },
      findOne: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([{ handle: '@older_one' }, { handle: '@older_two' }]),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

const modelReply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

let db;
let app;

beforeEach(() => {
  mockCreate.mockReset();
  db = buildDb();
  app = express();
  app.use(express.json());
  app.locals.db = db;
  app.use('/api/v1/social-profiles', router);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

const post = (body, authed = true) => {
  const r = request(app).post('/api/v1/social-profiles/autofill-draft');
  return (authed ? r.set('x-test-user', '1') : r).send(body);
};

describe('POST /autofill-draft', () => {
  it('returns 401 without auth and never calls the model', async () => {
    const res = await post({ layer: 'lalaverse', allowed: ALLOWED }, false);
    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns the six fields, dropping values outside the allowed lists, and saves nothing', async () => {
    mockCreate.mockResolvedValue(modelReply({
      handle: 'glow_theory',
      platform: 'myspace',              // not allowed → dropped
      vibe: 'Skincare chemist who films every failed batch.',
      city: 'nova_prime',               // legacy city, not in allowed → dropped
      relationship: 'sworn_enemies',    // not allowed → dropped
      careerPressure: 'ahead',          // allowed → kept
      extra: 'ignored',
    }));

    const res = await post({ layer: 'lalaverse', platform: 'tiktok', allowed: ALLOWED });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      handle: '@glow_theory',
      platform: '',
      vibe: 'Skincare chemist who films every failed batch.',
      city: '',
      relationship: '',
      careerPressure: 'ahead',
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].model).toBe('claude-haiku-4-5-20251001');
    expect(db.SocialProfile.create).not.toHaveBeenCalled();
    expect(db.SocialProfile.update).not.toHaveBeenCalled();
  });

  it('keeps in-list values and flags a handle only when every attempt is taken (1 + 2 retries)', async () => {
    db.SocialProfile.findOne.mockResolvedValue({ id: 9 });
    mockCreate.mockResolvedValue(modelReply({
      handle: '@taken_one', platform: 'youtube', vibe: 'Runway critic.',
      city: 'radiance_row', relationship: 'one_sided', careerPressure: 'level',
    }));

    const res = await post({ layer: 'lalaverse', allowed: ALLOWED });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      handle: '@taken_one', platform: 'youtube', vibe: 'Runway critic.',
      city: 'radiance_row', relationship: 'one_sided', careerPressure: 'level',
      handleTaken: true,
    });
    // Bounded: the first draft plus at most two retries — three paid calls.
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  // ── Task #1886: retries after a taken handle ─────────────────────────────
  it('checks the drafted handle with paranoid:false, so a soft-deleted holder counts as taken', async () => {
    mockCreate.mockResolvedValue(modelReply({ handle: '@free_one', platform: 'tiktok', vibe: 'x' }));

    await post({ layer: 'real_world', allowed: ALLOWED });

    expect(db.SocialProfile.findOne).toHaveBeenCalledTimes(1);
    expect(db.SocialProfile.findOne.mock.calls[0][0].paranoid).toBe(false);
  });

  it('re-asks when the first draft is taken, naming the taken handle and a sample of existing handles', async () => {
    db.SocialProfile.findOne
      .mockResolvedValueOnce({ id: 9, handle: '@studiobysable', deletedAt: null })
      .mockResolvedValueOnce(null);
    mockCreate
      .mockResolvedValueOnce(modelReply({ handle: '@studiobysable', platform: 'instagram', vibe: 'Studio owner.' }))
      .mockResolvedValueOnce(modelReply({ handle: '@thread_and_vow', platform: 'tiktok', vibe: 'Bridal tailor.' }));

    const res = await post({ layer: 'real_world', allowed: ALLOWED });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      handle: '@thread_and_vow', platform: 'tiktok', vibe: 'Bridal tailor.',
      city: '', relationship: '', careerPressure: '',
    });
    expect(res.body.handleTaken).toBeUndefined();
    expect(mockCreate).toHaveBeenCalledTimes(2);

    const firstPrompt = mockCreate.mock.calls[0][0].messages[0].content;
    const retryPrompt = mockCreate.mock.calls[1][0].messages[0].content;
    expect(firstPrompt).not.toContain('@studiobysable');
    expect(retryPrompt).toMatch(/already taken — do NOT use them[^\n]*@studiobysable/);
    expect(retryPrompt).toContain('@older_one');
    expect(retryPrompt).toContain('@older_two');
    expect(mockCreate.mock.calls[1][0].model).toBe('claude-haiku-4-5-20251001');

    // The sample is capped, same-layer, and includes soft-deleted rows.
    expect(db.SocialProfile.findAll).toHaveBeenCalledTimes(1);
    const sampleQuery = db.SocialProfile.findAll.mock.calls[0][0];
    expect(sampleQuery.where).toEqual({ feed_layer: 'real_world' });
    expect(sampleQuery.limit).toBe(25);
    expect(sampleQuery.paranoid).toBe(false);
  });

  it('names every taken handle so far on the last retry', async () => {
    db.SocialProfile.findOne.mockResolvedValue({ id: 9 });
    mockCreate
      .mockResolvedValueOnce(modelReply({ handle: '@one_taken', platform: 'tiktok', vibe: 'a' }))
      .mockResolvedValueOnce(modelReply({ handle: '@two_taken', platform: 'tiktok', vibe: 'b' }))
      .mockResolvedValueOnce(modelReply({ handle: '@three_taken', platform: 'tiktok', vibe: 'c' }));

    const res = await post({ layer: 'real_world', allowed: ALLOWED });

    expect(res.body).toMatchObject({ handle: '@three_taken', handleTaken: true });
    expect(mockCreate).toHaveBeenCalledTimes(3);
    const lastPrompt = mockCreate.mock.calls[2][0].messages[0].content;
    expect(lastPrompt).toContain('@one_taken, @two_taken');
  });

  it('returns the last taken draft, flagged, when a retry reply is unreadable', async () => {
    db.SocialProfile.findOne.mockResolvedValue({ id: 9 });
    mockCreate
      .mockResolvedValueOnce(modelReply({ handle: '@one_taken', platform: 'tiktok', vibe: 'a' }))
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'sorry' }] });

    const res = await post({ layer: 'real_world', allowed: ALLOWED });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ handle: '@one_taken', handleTaken: true });
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('leaves the LalaVerse fields blank on the real-world layer', async () => {
    mockCreate.mockResolvedValue(modelReply({
      handle: '@real_one', platform: 'instagram', vibe: 'Atlanta mom vlogger.',
      city: 'dazzle_district', relationship: 'one_sided', careerPressure: 'ahead',
    }));

    const res = await post({ layer: 'real_world', allowed: ALLOWED });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ handle: '@real_one', platform: 'instagram', city: '', relationship: '', careerPressure: '' });
  });

  it('returns 502 when the model reply has no JSON', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'sorry' }] });
    const res = await post({ layer: 'lalaverse', allowed: ALLOWED });
    expect(res.status).toBe(502);
  });
});
