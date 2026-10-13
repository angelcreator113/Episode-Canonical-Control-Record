/**
 * The episode post generator counts against The Pulse's daily requests
 * (Task #3051; phase 11 read §2 item 5): POST /api/v1/feed-posts/:episodeId/generate
 * takes one manual request per call, before its AI call; with the manual
 * lane used up it answers 429, as other Pulse routes do, and makes no call.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const queue = require('../../src/services/pulseQueue');
const requests = require('../../src/services/pulseRequests');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('The episode post generator takes a request (Task #3051)', () => {
  const ids = { show: crypto.randomUUID(), ep: crypto.randomUUID() };
  const savedKey = process.env.ANTHROPIC_API_KEY;
  let token;
  const generate = () => request(app).post(`/api/v1/feed-posts/${ids.ep}/generate`).set('Authorization', `Bearer ${token}`).send({ showId: ids.show });

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-user-gen-cap', email: 'ed@gen-cap.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { show: ids.show, name: `Gen cap ${ids.show.slice(0, 8)}`, slug: `gen-cap-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'The Gala', 1, 'draft', NOW(), NOW())`, ids);
  });

  afterAll(async () => {
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = savedKey;
    await run('DELETE FROM pulse_requests WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE id = :ep', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('one call takes one manual request, before the AI call', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: '[]' }] });
    const res = await generate();
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const ledger = await models.PulseRequest.findAll({ where: { show_id: ids.show } });
    expect(ledger.map((r) => [r.lane, r.kind])).toEqual([['manual', 'episode_posts']]);
    expect(await requests.usedToday(models, ids.show)).toEqual({ automated: 0, manual: 1 });
  });

  test('with the manual lane used up: 429 with the cap message, and no AI call', async () => {
    mockCreate.mockClear();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await queue.saveSettings(models, ids.show, { manual_requests: 1 });
    const res = await generate();
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: "Today's 1 manual request is used; it resets at midnight UTC.", code: 'PULSE_REQUESTS_USED' });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(await models.PulseRequest.count({ where: { show_id: ids.show } })).toBe(1);
  });
});
