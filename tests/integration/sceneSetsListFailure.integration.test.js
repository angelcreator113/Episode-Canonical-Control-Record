/**
 * GET /api/v1/scene-sets (audit TRUTH-02, 2026-10-03): a failed read is a
 * failed read, through the real route. Both queries failing is a 500 with a
 * code; the minimal query standing in for the one with includes is a
 * success marked degraded; a read that answers is a plain success.
 */
jest.unmock('uuid');

const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('GET /api/v1/scene-sets: honest failures (audit TRUTH-02)', () => {
  let token;
  const list = () => request(app).get('/api/v1/scene-sets').set('Authorization', `Bearer ${token}`);
  const quiet = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-scene-sets-list', email: 'user@scenesetslist.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    quiet.push(jest.spyOn(console, 'warn').mockImplementation(() => {}));
    quiet.push(jest.spyOn(console, 'error').mockImplementation(() => {}));
  });
  afterAll(() => quiet.forEach((s) => s.mockRestore()));
  afterEach(() => jest.restoreAllMocks());

  test('both queries failing is a 500 with a code, never an empty success', async () => {
    jest.spyOn(models.SceneSet, 'findAll').mockRejectedValue(new Error('relation vanished'));
    const res = await list();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'Scene sets could not be read', code: 'SCENE_SETS_UNAVAILABLE', detail: 'relation vanished' });
  });

  test('the minimal query standing in for the one with includes is a success marked degraded', async () => {
    jest.spyOn(models.SceneSet, 'findAll')
      .mockRejectedValueOnce(new Error('include broke'))
      .mockResolvedValueOnce([]);
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, count: 0, data: [] });
    expect(res.body.degraded).toEqual({
      omitted: ['angles', 'show', 'episodes'],
      text: 'Views, show names and episode links could not be read for this list',
      reason: 'include broke',
    });
  });

  test('a read that answers is a plain success, with no degraded mark', async () => {
    jest.spyOn(models.SceneSet, 'findAll').mockResolvedValue([]);
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, count: 0, data: [], scope: 'all' });
    expect(res.body.degraded).toBeUndefined();
  });
});
