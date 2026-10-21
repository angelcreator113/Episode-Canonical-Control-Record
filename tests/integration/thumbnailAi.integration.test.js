/**
 * AI help in the Thumbnail Studio (Evoni, 2026-10-21), through the real
 * routes: signed in only; without the server's key the ideas say so; a
 * picture that is not ours, or an unknown episode, is refused before any
 * paid call. (The calls themselves: tests/unit/services/thumbnailAiService.)
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('Thumbnail AI help (Templates › YouTube thumbnails)', () => {
  const show = crypto.randomUUID();
  const ep = crypto.randomUUID();
  const base = '/api/v1/youtube-thumbnails';
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const key = process.env.ANTHROPIC_API_KEY;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-ai', email: 'user@ai.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await sequelize.query('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { replacements: { show, name: `AI ${show.slice(0, 8)}`, slug: `ai-${show.slice(0, 8)}` } });
    await sequelize.query(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
                           VALUES (:ep, :show, 'Gala Night', 4, 'draft', NOW(), NOW())`, { replacements: { ep, show } });
  });
  afterAll(() => { process.env.ANTHROPIC_API_KEY = key; });

  test('signed out: 401 for both', async () => {
    expect((await request(app).post(`${base}/episodes/${ep}/title-ideas`)).status).toBe(401);
    expect((await request(app).post(`${base}/episodes/${ep}/pictures/cut-out`).send({ url: 'x' })).status).toBe(401);
  });

  test('title ideas without the server\'s key: 503, saying what is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await auth(request(app).post(`${base}/episodes/${ep}/title-ideas`));
    expect(res.status).toBe(503);
    expect(res.body.error).toContain('ANTHROPIC_API_KEY');
  });

  test('cut-out: a picture that is not ours is a 400; an unknown episode a 404', async () => {
    const bad = await auth(request(app).post(`${base}/episodes/${ep}/pictures/cut-out`)).send({ url: 'https://elsewhere.example/a.png' });
    expect(bad.status).toBe(400);
    const none = await auth(request(app).post(`${base}/episodes/${crypto.randomUUID()}/pictures/cut-out`)).send({ url: 'https://b.s3.amazonaws.com/a.png' });
    expect(none.status).toBe(404);
  });
});
