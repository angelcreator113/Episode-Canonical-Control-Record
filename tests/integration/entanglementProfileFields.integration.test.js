/**
 * GET /api/v1/entanglements/characters/:characterId/entanglements asked for a
 * social profile `follower_count` that no model or column has, so every call
 * failed with a database error (phase 11 read §2 item 10; Task #3053). It now
 * reads the stored follower_count_approx.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('Entanglements read the stored follower count (Task #3053)', () => {
  test("a character's entanglements answer (before the fix: 500, column profile.follower_count does not exist)", async () => {
    const token = TokenService.generateTokenPair({ id: 'test-user-entangle', email: 'ed@entangle.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get(`/api/v1/entanglements/characters/${crypto.randomUUID()}/entanglements`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ entanglements: [] });
  });
});
