/**
 * Amber's story reader is an ADMIN's (Evoni, 2026-11-16).
 *
 * POST /api/v1/amber/read-story turns up to 30 chunks of the caller's text
 * into speech with ElevenLabs, in a voice the caller names. Any signed-in
 * account could send it, and no screen does. Now: no token 401; a viewer or
 * an editor 403, refused before the handler, so no speech is asked for; an
 * ADMIN as before. POST /api/v1/amber/speak, the assistant's own voice, is
 * not changed: any signed-in account still reaches it.
 *
 * No speech is ever asked for here: the ADMIN and /speak cases send no text,
 * which the handler refuses (400) before it calls anything.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');

describe('Amber\'s story reader is an ADMIN\'s', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const tokens = {};
  let ipN = 0;
  let outbound;
  const post = (who, path, body) => {
    ipN += 1;
    const r = request(app).post(`/api/v1/amber${path}`).set('X-Forwarded-For', `198.51.190.${(ipN % 200) + 1}`);
    return (tokens[who] ? r.set('Authorization', `Bearer ${tokens[who]}`) : r).send(body);
  };
  const STORY = { text: 'Once upon a time in the LalaVerse.', voice_id: 'someone-elses-voice' };

  beforeAll(() => {
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@amber.dev`, name: id, groups, role }).accessToken;
    tokens.viewer = token(`viewer-${tag}`, ['viewer'], 'USER');
    tokens.editor = token(`editor-${tag}`, ['USER', 'EDITOR'], 'USER');
    tokens.admin = token(`admin-${tag}`, ['ADMIN'], 'ADMIN');
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    // Any speech request would go out through fetch: none may.
    outbound = jest.spyOn(global, 'fetch').mockImplementation(async () => { throw new Error('no outbound call is expected in this test'); });
  });
  afterEach(() => jest.restoreAllMocks());

  test('no token: 401, and no speech is asked for', async () => {
    const res = await post('anon', '/read-story', STORY);
    expect(res.status).toBe(401);
    expect(outbound).not.toHaveBeenCalled();
  });

  test.each(['viewer', 'editor'])('%s: 403 however often, with text or without, and no speech is asked for', async (who) => {
    for (const body of [STORY, STORY, {}, { text: 'x'.repeat(20000) }]) {
      const res = await post(who, '/read-story', body);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_GROUP_REQUIRED');
      expect(res.headers['content-type']).not.toMatch(/audio/);
    }
    expect(outbound).not.toHaveBeenCalled();
  });

  test('an ADMIN reaches the reader as before: with no text it answers 400 itself', async () => {
    const res = await post('admin', '/read-story', {});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('text required');
    expect(outbound).not.toHaveBeenCalled();
  });

  test.each(['viewer', 'editor', 'admin'])('/speak is not changed: %s still reaches it (400 for no text, never 403)', async (who) => {
    const res = await post(who, '/speak', {});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('text required');
    expect(outbound).not.toHaveBeenCalled();
  });

  test('one route was changed: /read-story carries the ADMIN check and /speak does not', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../src/routes/amberSessionRoutes.js'), 'utf8');
    expect(src).toMatch(/router\.post\('\/read-story', requireAuth, authorize\(\['ADMIN'\]\), readStoryLimiter,/);
    expect(src).toMatch(/router\.post\('\/speak', requireAuth, speakLimiter,/);
  });
});
