/**
 * CORS and Start Episode's Idempotency-Key (Evoni's ruling of 2026-11-13).
 *
 * The pages send `Idempotency-Key` with Start Episode (frontend/src/hooks/
 * useOfferDecision). From the app's own origin a browser asks nothing
 * first; from another allowed origin it sends a preflight naming the
 * header, and the server must allow it or the browser never sends the
 * Start. Only that header was added to the allow-list (src/app.js); the
 * origins, methods, credentials and every other header are as they were.
 */
jest.unmock('uuid');

const request = require('supertest');
const app = require('../../src/app');
const { sequelize } = require('../../src/models');

const ORIGIN = 'http://localhost:5174';
const START = '/api/v1/world/11111111-1111-4111-8111-111111111111/events/22222222-2222-4222-8222-222222222222/generate-episode';
const preflight = (path, headers, origin = ORIGIN) => request(app).options(path)
  .set('Origin', origin).set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', headers);
const allowed = (res) => String(res.headers['access-control-allow-headers'] || '').split(',').map((h) => h.trim().toLowerCase());

describe('CORS preflight', () => {
  afterAll(async () => { await sequelize.close().catch(() => {}); });

  it('allows Idempotency-Key on both Start Episode routes, with the headers a Start already sends', async () => {
    for (const path of [START, '/api/v1/world/11111111-1111-4111-8111-111111111111/events/generate-episode-from-many']) {
      const res = await preflight(path, 'authorization,content-type,idempotency-key');
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
      expect(allowed(res)).toEqual(expect.arrayContaining(['idempotency-key', 'authorization', 'content-type']));
    }
  });

  it('the allow-list is the one it was, plus that header', async () => {
    const res = await preflight(START, 'idempotency-key');
    expect(allowed(res).sort()).toEqual(['authorization', 'content-type', 'idempotency-key', 'x-remote-token', 'x-requested-with']);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(String(res.headers['access-control-allow-methods'])).toBe('GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  });

  it('a header that was never allowed is still not allowed', async () => {
    const res = await preflight(START, 'x-not-a-real-header');
    expect(allowed(res)).not.toContain('x-not-a-real-header');
  });

  it('an origin that is not allowed is still refused, whatever header it names', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await preflight(START, 'idempotency-key', 'https://not-allowed.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.status).toBeGreaterThanOrEqual(400);
    jest.restoreAllMocks();
  });
});
