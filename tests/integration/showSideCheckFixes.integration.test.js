/**
 * The show side check's fixes (Evoni, 2026-10-20: "yes start the fixes with
 * your recommendations"):
 *
 *   F1  Lala's reactions to a Pulse person: POST /social-profiles/:id/lala-reactions
 *       (ADMIN, aiRateLimiter, MODELS two-attempt loop, utils/aiFailure); the
 *       panel used /memories/ai, which never existed
 *   F2  Scene Studio's Transform on a scene set: POST /scene-sets/:id/transform-object
 *   F4  /api/v1/thumbnails is retired (2026-10-22: no page called it; its model
 *       is not production's thumbnails table): its reads answer 404
 *   F7  GET /social-profiles/underground reaches the underground router instead of
 *       500ing in GET /social-profiles/:id
 *   P4  wardrobe-events suggest and world events ai-fix: rate-limited, two tries
 *       per model, budget 429 / unreachable 502
 *
 * The database is the local migrated test DB; the Anthropic SDK is mocked.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const db = require('../../src/models');

const { sequelize } = db;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const reply = (text) => ({ content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 } });
const unreachable = () => Object.assign(new Error('Connection error.'), { name: 'APIConnectionError' });
// aiRateLimiter runs after the app-wide limiters, so its limit is the one in the
// response's RateLimit headers when the route carries it.
const AI_LIMIT = String(parseInt(process.env.AI_RATE_LIMIT_PER_IP || '30', 10));
const expectAiLimited = (res) => expect(res.headers['ratelimit-limit']).toBe(AI_LIMIT);
const overBudget = () => Object.assign(new Error('Daily AI budget reached.'), { code: 'AI_BUDGET_EXCEEDED' });

(shouldSkip ? describe.skip : describe)('the show side check fixes', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = {
    show: crypto.randomUUID(), episode: crypto.randomUUID(), event: crypto.randomUUID(), set: crypto.randomUUID(),
  };
  const profiles = {};
  let adminToken;
  let editorToken;
  const asAdmin = (r) => r.set('Authorization', `Bearer ${adminToken}`);
  const asEditor = (r) => r.set('Authorization', `Bearer ${editorToken}`);

  const addProfile = async (key, extra = '') => {
    const [[row]] = await run(
      `INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, follower_count_approx, created_at, updated_at${extra ? ', is_justawoman_record' : ''})
       VALUES (:handle, 'instagram', 'soft mornings and slow coffee', 'lalaverse', '900K', NOW(), NOW()${extra ? ', true' : ''}) RETURNING id`,
      { handle: `${key}${TAG}` });
    profiles[key] = row.id;
  };

  beforeAll(async () => {
    adminToken = TokenService.generateTokenPair({ id: 'test-admin-show-fix', email: 'a@show-fix.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editorToken = TokenService.generateTokenPair({ id: 'test-user-show-fix', email: 'u@show-fix.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Show fix ${TAG}`, slug: `show-fix-${TAG}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:episode, :show, 'Show fix ep', :n, 'draft', NOW(), NOW())`,
    { ...ids, n: Math.floor(Math.random() * 100000) + 300 });
    await run(`INSERT INTO world_events (id, show_id, name, dress_code, prestige, created_at, updated_at)
               VALUES (:event, :show, 'Velvet Hour', 'cocktail', 6, NOW(), NOW())`, ids);
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, generation_status, created_at, updated_at)
               VALUES (:set, 'Show fix set', 'HOME_BASE', :show, 'complete', NOW(), NOW())`, ids);
    await addProfile('slowsift');
    await addProfile('jaw', 'locked');
  });

  beforeEach(() => {
    mockCreate.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await run('DELETE FROM scene_sets WHERE id = :set', ids);
    await run('DELETE FROM world_events WHERE id = :event', ids);
    await run('DELETE FROM episodes WHERE id = :episode', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: Object.values(profiles) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  describe('F1: Lala\'s reactions', () => {
    const url = () => `/api/v1/social-profiles/${profiles.slowsift}/lala-reactions`;

    it('an ADMIN gets up to four reactions, built from the profile on the server', async () => {
      const five = Array.from({ length: 5 }, (_, i) => ({ trigger: `t${i}`, internal_monologue: 'm', what_she_posts: 'p', emotional_cost: 'c' }));
      mockCreate.mockResolvedValueOnce(reply(`Here:\n${JSON.stringify(five)}`));
      const res = await asAdmin(request(app).post(url()));
      expect(res.status).toBe(200);
      expect(res.body.reactions).toHaveLength(4);
      expectAiLimited(res);
      expect(mockCreate.mock.calls[0][0].messages[0].content).toContain(`slowsift${TAG} (instagram)`);
    });

    it('a signed-in non-admin is refused and nothing is spent', async () => {
      const res = await asEditor(request(app).post(url()));
      expect(res.status).toBe(403);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('a missing profile is 404 and JustAWoman\'s record is 403, before any AI call', async () => {
      expect((await asAdmin(request(app).post('/api/v1/social-profiles/999999999/lala-reactions'))).status).toBe(404);
      expect((await asAdmin(request(app).post(`/api/v1/social-profiles/${profiles.jaw}/lala-reactions`))).status).toBe(403);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('an unreadable answer is 502; an unreachable AI is tried twice then 502; a budget refusal is 429 at once', async () => {
      mockCreate.mockResolvedValueOnce(reply('not json at all'));
      expect((await asAdmin(request(app).post(url()))).status).toBe(502);

      mockCreate.mockReset();
      mockCreate.mockRejectedValue(unreachable());
      const down = await asAdmin(request(app).post(url()));
      expect(down.status).toBe(502);
      expect(down.body.error).toBe(require('../../src/utils/aiFailure').UNREACHABLE);
      expect(mockCreate).toHaveBeenCalledTimes(2);

      mockCreate.mockReset();
      mockCreate.mockRejectedValue(overBudget());
      expect((await asAdmin(request(app).post(url()))).status).toBe(429);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  it('F7: GET /social-profiles/underground reaches the underground list, not a 500', async () => {
    const res = await asAdmin(request(app).get('/api/v1/social-profiles/underground'));
    expect(res.status).toBe(200);
    // A profile id still reads its profile.
    expect((await asAdmin(request(app).get(`/api/v1/social-profiles/${profiles.slowsift}`))).status).toBe(200);
  });

  describe('F2: Transform on a scene set', () => {
    it('the route exists and reaches the transform (400 without an image)', async () => {
      const res = await asAdmin(request(app).post(`/api/v1/scene-sets/${ids.set}/transform-object`).send({ prompt: 'make it velvet' }));
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('image_url is required');
      expectAiLimited(res);
    });

    it('a scene set that does not exist is 404', async () => {
      const res = await asAdmin(request(app).post(`/api/v1/scene-sets/${crypto.randomUUID()}/transform-object`)
        .send({ image_url: 'https://x/a.png', prompt: 'p' }));
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Scene set not found');
    });

    it('needs a sign-in', async () => {
      expect((await request(app).post(`/api/v1/scene-sets/${ids.set}/transform-object`).send({})).status).toBe(401);
    });
  });

  describe('F4: /api/v1/thumbnails is retired', () => {
    it('its reads answer 404; the Studio\'s saved list is the way to an episode\'s thumbnail', async () => {
      expect((await request(app).get('/api/v1/thumbnails/1/url')).status).toBe(404);
      expect((await request(app).get(`/api/v1/thumbnails/episode/${ids.episode}/primary`)).status).toBe(404);
    });
  });

  describe('P4: the two AI routes are rate-limited and try twice', () => {
    it('wardrobe-events suggest: 200 with a suggestion, rate-limited', async () => {
      mockCreate.mockResolvedValueOnce(reply('{"outfit_name":"Velvet","vibe":"low light","items":[],"lala_reaction":"Yes.","confidence_boost":7}'));
      const res = await asAdmin(request(app).post(`/api/v1/wardrobe-events/${ids.show}/suggest`).send({ event_id: ids.event }));
      expect(res.status).toBe(200);
      expect(res.body.data.outfit_name).toBe('Velvet');
      expectAiLimited(res);
    });

    it('wardrobe-events suggest: an unreachable AI is tried twice then 502; a budget refusal is 429', async () => {
      mockCreate.mockRejectedValue(unreachable());
      const down = await asAdmin(request(app).post(`/api/v1/wardrobe-events/${ids.show}/suggest`).send({ event_id: ids.event }));
      expect(down.status).toBe(502);
      expect(mockCreate).toHaveBeenCalledTimes(2);

      mockCreate.mockReset();
      mockCreate.mockRejectedValue(overBudget());
      expect((await asAdmin(request(app).post(`/api/v1/wardrobe-events/${ids.show}/suggest`).send({ event_id: ids.event }))).status).toBe(429);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('world events ai-fix: a first failure is retried, and the route is rate-limited', async () => {
      mockCreate.mockRejectedValueOnce(unreachable()).mockResolvedValueOnce(reply('[{"warning":"w","suggestion":"s","action":"rename","event_id":"x"}]'));
      const res = await asAdmin(request(app).post(`/api/v1/world/${ids.show}/events/ai-fix`).send({ warnings: ['w'], events: [] }));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expectAiLimited(res);
    });

    it('world events ai-fix: an unreachable AI is 502, a budget refusal 429', async () => {
      mockCreate.mockRejectedValue(unreachable());
      expect((await asAdmin(request(app).post(`/api/v1/world/${ids.show}/events/ai-fix`).send({ warnings: [], events: [] }))).status).toBe(502);
      mockCreate.mockReset();
      mockCreate.mockRejectedValue(overBudget());
      expect((await asAdmin(request(app).post(`/api/v1/world/${ids.show}/events/ai-fix`).send({ warnings: [], events: [] }))).status).toBe(429);
    });
  });
});
