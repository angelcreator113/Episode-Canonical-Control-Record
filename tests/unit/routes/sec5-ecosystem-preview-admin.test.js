/**
 * SEC-5 (Evoni's admin-only ruling, 2026-10-29): POST
 * /api/v1/world/generate-ecosystem-preview is admin only. It was public, so
 * anyone could run its Claude call and spend the studio's shared daily AI
 * budget. The real router and auth middleware; the models and the Anthropic
 * client are stand-ins, so no AI call is made.
 */
const mockCreate = jest.fn(async () => ({ content: [{ type: 'text', text: '{"characters":[]}' }], usage: {} }));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));
jest.mock('../../../src/models', () => ({}));

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');

const app = express();
app.use(express.json());
app.use('/api/v1', require('../../../src/routes/worldStudio'));

const token = (groups) => TokenService.generateTokenPair({ id: `sec5-${groups.join('-') || 'none'}`, email: 'sec5@test.dev', name: 'sec5', groups, role: groups[0] }).accessToken;
const preview = (auth) => {
  const r = request(app).post('/api/v1/world/generate-ecosystem-preview');
  return (auth ? r.set('Authorization', `Bearer ${auth}`) : r).send({ world_tag: 'lalaverse', character_count: 3 });
};

describe('SEC-5: the ecosystem preview is admin only', () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  beforeAll(() => { process.env.ANTHROPIC_API_KEY = 'test-key'; });
  afterAll(() => { if (prev === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prev; });
  beforeEach(() => mockCreate.mockClear());

  test('without a sign-in: 401 and no AI call', async () => {
    const res = await preview(null);
    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('signed in but not an admin: 403 and no AI call', async () => {
    const res = await preview(token(['USER']));
    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('an admin gets past the guard', async () => {
    const res = await preview(token(['ADMIN']));
    expect([401, 403]).not.toContain(res.status);
  });
});
