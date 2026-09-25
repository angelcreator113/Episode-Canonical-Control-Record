// ============================================================================
// Task #1886 — POST /social-profiles/generate refuses a handle that already
// exists (live or soft-deleted) with 409, BEFORE the Sonnet call and before any
// write. Mocked, no database, no AI call: the Anthropic SDK is a jest mock and
// the route is mounted alone. The lookup's WHERE is rendered against the real
// SocialProfile model (never connected) to show the escaped ILIKE forms.
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

let db;
let app;

function buildDb(holder) {
  return {
    SocialProfile: {
      rawAttributes: {},
      findOne: jest.fn().mockResolvedValue(holder),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
    },
  };
}

function mount(holder) {
  db = buildDb(holder);
  app = express();
  app.use(express.json());
  app.locals.db = db;
  app.use('/api/v1/social-profiles', router);
}

beforeEach(() => {
  mockCreate.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

const postGenerate = (body) => request(app)
  .post('/api/v1/social-profiles/generate')
  .set('x-test-user', '1')
  .send({ platform: 'instagram', vibe_sentence: 'Studio owner who films every fitting.', ...body });

describe('POST /generate — taken handle (Task #1886)', () => {
  it('refuses a live handle with 409, with no model call and no write', async () => {
    mount({ id: 12, handle: '@studiobysable', deletedAt: null });

    const res = await postGenerate({ handle: 'StudioBySable' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      handleTaken: true,
      handle: '@StudioBySable',
      holder: { id: 12, deleted: false },
    });
    expect(res.body.error).toContain('@StudioBySable');
    expect(res.body.error).toMatch(/already taken by an existing creator/);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(db.SocialProfile.create).not.toHaveBeenCalled();
    expect(db.SocialProfile.count).not.toHaveBeenCalled();
  });

  it('refuses a soft-deleted handle with 409 naming it deleted, and says to restore or purge', async () => {
    mount({ id: 7, handle: '@studiobysable', deletedAt: new Date('2026-09-20T00:00:00Z') });

    const res = await postGenerate({ handle: '@studiobysable' });

    expect(res.status).toBe(409);
    expect(res.body.holder).toEqual({ id: 7, deleted: true });
    expect(res.body.error).toBe('@studiobysable belongs to a deleted creator (id 7) — restore or purge it to reuse the handle.');
    expect(mockCreate).not.toHaveBeenCalled();
    expect(db.SocialProfile.create).not.toHaveBeenCalled();
  });

  it('looks the handle up case-insensitively, with and without @, wildcards escaped, soft-deleted rows included', async () => {
    mount({ id: 3, handle: '@glow_theory', deletedAt: null });

    await postGenerate({ handle: '@glow_theory' });

    expect(db.SocialProfile.findOne).toHaveBeenCalledTimes(1);
    const query = db.SocialProfile.findOne.mock.calls[0][0];
    expect(query.paranoid).toBe(false);

    // Render the lookup against the real model definition (paranoid, as
    // src/config/sequelize.js defines it) to show the SQL it would run.
    const sequelize = new Sequelize('postgres://u:p@127.0.0.1:1/unused', {
      logging: false,
      define: { underscored: true, timestamps: true, paranoid: true, freezeTableName: true },
    });
    const Model = require('../../../src/models/SocialProfile')(sequelize, DataTypes);
    const sql = sequelize.getQueryInterface().queryGenerator.selectQuery(
      'social_profiles', { ...query, attributes: [['id', 'id']], limit: 1 }, Model,
    );
    expect(sql).toContain(`"handle" ILIKE '@glow\\_theory'`);
    expect(sql).toContain(`"handle" ILIKE 'glow\\_theory'`);
    // The deleted_at IS NULL filter is added by Model.findOne itself, not the
    // query generator, so paranoid:false is asserted on the options above.
  });

  it('proceeds to the Sonnet call when the handle is free', async () => {
    mount(null);
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: '' }] });

    const res = await postGenerate({ handle: '@brand_new' });

    // Empty model reply → the existing 500 path; what matters is that the
    // guard let the request through to the model.
    expect(res.status).toBe(500);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].model).toBe('claude-sonnet-4-6');
  });

  it('returns 400 for a non-string handle before any lookup', async () => {
    mount(null);

    const res = await postGenerate({ handle: ['@a'] });

    expect(res.status).toBe(400);
    expect(db.SocialProfile.findOne).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
