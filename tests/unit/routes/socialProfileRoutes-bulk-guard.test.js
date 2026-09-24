// ============================================================================
// Bulk handlers never touch the locked JustAWoman record; bulk delete also
// keeps Crossed and entangled profiles (Task #1827). Mocked, no database: the
// fake models below honor only the where clauses the routes pass.
// ============================================================================

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-anthropic-key';

const express = require('express');
const request = require('supertest');

jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
// Requests carrying x-test-user are authenticated; anything else goes through
// the real requireAuth, so the 401 case exercises production middleware.
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

const inIds = (where, key) => where[key][Object.getOwnPropertySymbols(where[key])[0]].map(String);

function buildDb() {
  const profiles = [
    { id: 1, handle: '@normal_one', status: 'generated', is_justawoman_record: false },
    { id: 2, handle: '@justawoman', status: 'crossed', is_justawoman_record: true },
    { id: 3, handle: '@crossed_one', status: 'crossed', is_justawoman_record: false },
    { id: 4, handle: '@entangled_ce', status: 'finalized', is_justawoman_record: false },
    { id: 5, handle: '@entangled_ev', status: 'generated', is_justawoman_record: false },
    { id: 6, handle: '@entangled_un', status: 'generated', is_justawoman_record: false },
    { id: 7, handle: '@normal_two', status: 'finalized', is_justawoman_record: false },
  ];
  const linkModel = (profileIds) => ({
    findAll: jest.fn(async ({ where }) => {
      const wanted = inIds(where, 'profile_id');
      return profileIds.filter((id) => wanted.includes(String(id))).map((id) => ({ profile_id: id }));
    }),
  });
  return {
    profiles,
    SocialProfile: {
      findAll: jest.fn(async ({ where }) => {
        const wanted = inIds(where, 'id');
        return profiles.filter((p) => wanted.includes(String(p.id)));
      }),
      destroy: jest.fn(async ({ where }) => inIds(where, 'id').length),
      update: jest.fn(async (_values, { where }) => [inIds(where, 'id').length]),
    },
    CharacterEntanglement: linkModel([4]),
    EntanglementEvent: linkModel([5]),
    EntanglementUnfollow: linkModel([6]),
  };
}

let db;
let app;

beforeEach(() => {
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

const post = (path, ids) => request(app)
  .post(`/api/v1/social-profiles/${path}`)
  .set('x-test-user', '1')
  .send({ ids });

describe('POST /bulk/delete', () => {
  it('deletes only the normal profiles and reports each skip with its reason', async () => {
    const res = await post('bulk/delete', [1, 2, 3, 4, 5, 6, 7]);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toEqual([1, 7]);
    const reasons = Object.fromEntries(res.body.skipped.map((s) => [s.id, s.reason]));
    expect(reasons).toEqual({ 2: 'locked', 3: 'crossed', 4: 'entangled', 5: 'entangled', 6: 'entangled' });
    expect(res.body.skipped.find((s) => s.id === 2).handle).toBe('@justawoman');

    expect(db.SocialProfile.destroy).toHaveBeenCalledTimes(1);
    expect(inIds(db.SocialProfile.destroy.mock.calls[0][0].where, 'id')).toEqual(['1', '7']);
  });

  it('never destroys when every id is protected', async () => {
    const res = await post('bulk/delete', [2, 3, 4]);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toEqual([]);
    expect(res.body.skipped).toHaveLength(3);
    expect(db.SocialProfile.destroy).not.toHaveBeenCalled();
  });

  it('does not report unknown ids as deleted', async () => {
    const res = await post('bulk/delete', [1, 999]);
    expect(res.body.deleted).toEqual([1]);
  });

  it('checks entanglements with one query per table, not per id', async () => {
    await post('bulk/delete', [1, 4, 5, 6, 7]);
    expect(db.CharacterEntanglement.findAll).toHaveBeenCalledTimes(1);
    expect(db.EntanglementEvent.findAll).toHaveBeenCalledTimes(1);
    expect(db.EntanglementUnfollow.findAll).toHaveBeenCalledTimes(1);
  });

  it('deletes nothing if an entanglement lookup fails', async () => {
    db.EntanglementEvent.findAll.mockRejectedValue(new Error('db down'));
    const res = await post('bulk/delete', [1, 7]);
    expect(res.status).toBe(500);
    expect(db.SocialProfile.destroy).not.toHaveBeenCalled();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/social-profiles/bulk/delete').send({ ids: [1] });
    expect(res.status).toBe(401);
    expect(db.SocialProfile.destroy).not.toHaveBeenCalled();
  });
});

describe.each([
  ['bulk/archive', 'archived'],
  ['bulk/finalize', 'finalized'],
  ['bulk/cross', 'crossed'],
])('POST /%s', (path, countField) => {
  it('skips the locked record and keeps its existing count fields', async () => {
    const res = await post(path, [1, 2, 7]);
    expect(res.status).toBe(200);
    expect(inIds(db.SocialProfile.update.mock.calls[0][1].where, 'id')).toEqual(['1', '7']);
    expect(res.body.locked).toEqual([{ id: 2, handle: '@justawoman', reason: 'locked' }]);
    expect(res.body[countField]).toBe(2);
    expect(res.body.total).toBe(3);
    expect(res.body.skipped).toBe(1);
  });

  it('does not update when only the locked record is sent', async () => {
    const res = await post(path, [2]);
    expect(res.status).toBe(200);
    expect(res.body[countField]).toBe(0);
    expect(db.SocialProfile.update).not.toHaveBeenCalled();
  });
});
