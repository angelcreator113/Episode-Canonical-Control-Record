/**
 * A request with no body (Evoni's Season Plan, 2026-10-25: tapping Advance
 * gave "Cannot destructure property 'episode_number' of 'req.body' as it
 * is undefined"). Express 5 leaves req.body undefined when nothing is sent;
 * app.js now hands every route an empty object instead. The routes that
 * refuse a missing body still refuse an empty one.
 */
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('a request with no body', () => {
  let admin;
  const auth = (r) => r.set('Authorization', `Bearer ${admin}`);

  beforeAll(() => {
    admin = TokenService.generateTokenPair({ id: 'test-empty-body', email: 'evoni@empty-body.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  });
  afterAll(async () => {
    await sequelize.close();
  });

  test('a route reading fields from the body gets an empty object, not a crash', async () => {
    // An unknown show: the advance answers that there is no season, not a TypeError.
    const res = await auth(request(app).post(`/api/v1/world/${crypto.randomUUID()}/arc/advance`));
    expect(JSON.stringify(res.body)).not.toMatch(/Cannot destructure|of 'req\.body'/);
  });

  test('the character and event edits still refuse a request with nothing in it', async () => {
    const character = await auth(request(app).put(`/api/v1/character-registry/characters/${crypto.randomUUID()}`));
    expect(character.status).toBe(400);
    expect(character.body.error).toBe('Request body is required');
    const event = await auth(request(app).put(`/api/v1/world/${crypto.randomUUID()}/events/${crypto.randomUUID()}`));
    expect(event.status).toBe(400);
    expect(event.body.code).toBe('INVALID_JSON_BODY');
  });
});
