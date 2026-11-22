/**
 * A script's analysis is an ADMIN's to read (Evoni, 2026-11-22). GET
 * /api/scripts/:scriptId/metadata answered any signed-in account with a
 * script's scene breakdown. It now needs a sign-in in the admin group. The
 * two writes of the file are as they were.
 *
 * The real router and auth middleware; the model, the pool and the analysis
 * service are stand-ins, so no database is read and no model is asked.
 */
const mockFindAll = jest.fn();
const mockPoolQuery = jest.fn();
jest.mock('../../../src/models', () => ({ ScriptMetadata: { findAll: (...a) => mockFindAll(...a) } }));
jest.mock('pg', () => ({ Pool: jest.fn(() => ({ query: (...a) => mockPoolQuery(...a) })) }));
jest.mock('../../../src/services/claudeService', () => ({ isConfigured: () => false, analyzeScript: jest.fn() }));

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');

const app = express();
app.use(express.json());
app.use('/api/scripts', require('../../../src/routes/scriptAnalysis'));

const token = (groups) => TokenService.generateTokenPair({
  id: `analysis-${groups.join('-') || 'none'}`, email: 'analysis@test.dev', name: 'analysis', groups, role: groups[0],
}).accessToken;
const metadata = (auth) => {
  const r = request(app).get('/api/scripts/7/metadata');
  return auth ? r.set('Authorization', `Bearer ${auth}`) : r;
};

const SCENE = { id: 'm-1', script_id: 7, scene_id: 'INTRO', scene_type: 'intro', energy_level: 'high', visual_requirements: { wardrobe: 'the unpublished look' } };

beforeEach(() => {
  mockFindAll.mockReset();
  mockPoolQuery.mockReset();
  mockFindAll.mockResolvedValue([SCENE]);
  mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe('GET /api/scripts/:scriptId/metadata needs a sign-in in the admin group', () => {
  test('signed out: a 401, and nothing is read', async () => {
    expect((await metadata(null)).status).toBe(401);
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  test('signed in but not an admin: a 403, and nothing is read', async () => {
    for (const groups of [['USER'], ['EDITOR'], ['VIEWER'], ['USER', 'EDITOR'], []]) {
      const res = await metadata(token(groups));
      expect(res.status).toBe(403);
      expect(res.body.metadata).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('unpublished look');
    }
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  test('an admin: the script\'s scenes, as they were', async () => {
    const res = await metadata(token(['ADMIN']));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, metadata: [SCENE], count: 1 });
    expect(mockFindAll).toHaveBeenCalledWith({ where: { script_id: '7' }, order: [['created_at', 'ASC']] });
  });
});

describe('the two writes are as they were', () => {
  test('signed out, they are a 401', async () => {
    expect((await request(app).put('/api/scripts/7/ai-analysis').send({ enabled: true })).status).toBe(401);
    expect((await request(app).post('/api/scripts/7/analyze').send({})).status).toBe(401);
  });
  test('signed in and not an admin, the toggle is not refused for the group', async () => {
    const res = await request(app).put('/api/scripts/7/ai-analysis').set('Authorization', `Bearer ${token(['USER'])}`).send({ enabled: true });
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
