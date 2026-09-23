// ============================================================================
// POST /api/v1/memories/character-growth/:id/review — gate and whitelist (#1709)
// ============================================================================
// The field written comes from the stored log row (log.field_updated, chosen
// by the AI), never from the request. Admin only; 'accepted' and 'modified'
// may write only REVIEW_WRITABLE_FIELDS; 'reverted' writes nothing and stays
// allowed for any field. Mocked, no database.

const express = require('express');
const request = require('supertest');

const mockCharacter = { id: 'c1', selected_name: 'Lala', depth_level: 'active', update: jest.fn(async () => {}) };
let mockLog;
const makeLog = (field) => ({
  id: 'log1', character_id: 'c1', field_updated: field, new_value: 'proposed by the engine',
  update: jest.fn(async () => {}),
});

jest.mock('../../../src/models', () => ({
  CharacterGrowthLog: { findByPk: jest.fn(async () => mockLog) },
  RegistryCharacter: { findByPk: jest.fn(async () => mockCharacter) },
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return {
    ...actual,
    requireAuth: (req, res, next) => {
      const h = req.headers['x-test-groups'];
      if (h === undefined) return res.status(401).json({ error: 'Unauthorized' });
      req.user = { id: 'u1', groups: h ? h.split(',') : [] };
      next();
    },
  };
});

const router = require('../../../src/routes/characterGrowthRoute');

const app = express();
app.use(express.json());
app.use('/api/v1/memories', router);

const review = (groups, body) => {
  let r = request(app).post('/api/v1/memories/character-growth/log1/review');
  if (groups !== undefined) r = r.set('x-test-groups', groups);
  return r.send(body);
};

beforeEach(() => {
  mockCharacter.update.mockClear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('admin, whitelisted field', () => {
  test('accepting a log row whose field_updated is whitelisted writes it', async () => {
    mockLog = makeLog('wound');
    const res = await review('admin', { decision: 'accepted' });
    expect(res.status).toBe(200);
    expect(mockCharacter.update).toHaveBeenCalledWith({ wound: 'proposed by the engine' });
    expect(mockLog.update).toHaveBeenCalledWith(expect.objectContaining({ author_reviewed: true, author_decision: 'accepted' }));
  });

  test('modifying it writes the caller-supplied value', async () => {
    mockLog = makeLog('wound');
    const res = await review('Admin', { decision: 'modified', modified_value: 'her version' });
    expect(res.status).toBe(200);
    expect(mockCharacter.update).toHaveBeenCalledWith({ wound: 'her version' });
  });
});

describe('admin, field not whitelisted', () => {
  test.each(['psychology', 'voice_notes', 'not_a_column'])('accepting a log row naming %s is rejected, logged, and writes nothing', async (field) => {
    mockLog = makeLog(field);
    const res = await review('admin', { decision: 'accepted' });
    expect(res.status).toBe(422);
    expect(res.body.field).toBe(field);
    expect(res.body.writable_fields).toEqual(['wound']);
    expect(mockCharacter.update).not.toHaveBeenCalled();
    expect(mockLog.update).not.toHaveBeenCalled(); // not marked reviewed
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(`field "${field}" is not writable`));
  });

  test('modifying a non-whitelisted field is rejected too', async () => {
    mockLog = makeLog('psychology');
    const res = await review('admin', { decision: 'modified', modified_value: 'x' });
    expect(res.status).toBe(422);
    expect(mockCharacter.update).not.toHaveBeenCalled();
  });
});

describe('never-writable fields are rejected even for an admin', () => {
  test.each([
    'character_key', 'registry_id', 'status', 'feed_profile_id', 'id', 'deleted_at',
    'de_blind_spot', 'de_blind_spot_evidence', 'de_blind_spot_crack_condition', 'de_actual_narrative_gap',
  ])('a log row naming %s is rejected', async (field) => {
    mockLog = makeLog(field);
    for (const decision of ['accepted', 'modified']) {
      const res = await review('admin', { decision, modified_value: 'x' });
      expect(res.status).toBe(422);
    }
    expect(mockCharacter.update).not.toHaveBeenCalled();
  });
});

describe("'reverted' stays allowed for any field, so every flag can be dismissed", () => {
  test.each(['wound', 'psychology', 'character_key'])('reverting a log row naming %s marks it reviewed and writes nothing', async (field) => {
    mockLog = makeLog(field);
    const res = await review('admin', { decision: 'reverted' });
    expect(res.status).toBe(200);
    expect(mockCharacter.update).not.toHaveBeenCalled();
    expect(mockLog.update).toHaveBeenCalledWith(expect.objectContaining({ author_reviewed: true, author_decision: 'reverted' }));
  });
});

describe('non-admins are refused entirely', () => {
  test.each(['editor', 'viewer', ''])('group "%s" gets 403 and nothing is written or reviewed', async (groups) => {
    mockLog = makeLog('wound');
    for (const decision of ['accepted', 'modified', 'reverted']) {
      const res = await review(groups, { decision, modified_value: 'x' });
      expect(res.status).toBe(403);
    }
    expect(mockCharacter.update).not.toHaveBeenCalled();
    expect(mockLog.update).not.toHaveBeenCalled();
  });

  test('unauthenticated caller gets 401', async () => {
    mockLog = makeLog('wound');
    const res = await review(undefined, { decision: 'accepted' });
    expect(res.status).toBe(401);
    expect(mockCharacter.update).not.toHaveBeenCalled();
  });
});
