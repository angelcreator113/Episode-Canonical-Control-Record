/**
 * Completing an episode: who may, how it is named, and what a repeat or a
 * refusal does (Evoni, 2026-11-12).
 *
 * The one operation is services/episodeCompletionService completeEpisode,
 * reached by POST /world/:showId/episodes/:episodeId/complete (and by the
 * legacy POST /episodes/:id/accept, which proxies to it). Both are admin
 * only: the same authorize(['ADMIN']) every other admin route uses.
 *
 *   - a signed-out request and a signed-in non-admin are refused by the API
 *     itself, and nothing is written;
 *   - the episode is completed by its own id: the event's link back to the
 *     episode is not needed (the brief names the event);
 *   - a repeat books nothing twice and answers "already completed";
 *   - a refusal writes nothing; a lock conflict is the retryable 409;
 *   - an override recorded on an estimate is kept until completion and is
 *     not applied by it (the stored result is the one completion computes).
 *
 * No model is called.
 */
jest.unmock('uuid');

const mockAsk = { create: jest.fn(async () => { throw new Error('the model must not be asked'); }) };
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: (...a) => mockAsk.create(...a) } })));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const completion = require('../../src/services/episodeCompletionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('completing an episode', () => {
  const shows = [];
  let admin;
  let editor;
  let testNumber = 0;
  const from = (r) => r.set('X-Forwarded-For', `10.73.${Math.floor(testNumber / 250)}.${(testNumber % 250) + 1}`);
  const as = (token, r) => (token ? from(r).set('Authorization', `Bearer ${token}`) : from(r));
  const complete = (token, f) => as(token, request(app).post(`/api/v1/world/${f.show}/episodes/${f.episode}/complete`)).send({});
  const accept = (token, f) => as(token, request(app).post(`/api/v1/episodes/${f.episode}/accept`)).send({});

  /** An episode whose brief names its event. reverseLink: whether the event's own link points back at it. */
  async function seed({ reverseLink = true, coins = 1000 } = {}) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :n, :n, '{}'::jsonb, NOW(), NOW())`, { show, n: `complete-${show.slice(0, 8)}` });
    await models.CharacterState.create({ show_id: show, character_key: 'lala', coins, reputation: 3 });
    const episode = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:episode, :show, 'Gala Night', 1, 'draft', NOW(), NOW())`, { episode, show });
    const event = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, used_in_episode_id, is_paid, payment_amount, canon_consequences, created_at, updated_at)
               VALUES (:event, :show, 'Velvet Gala', 'invite', 'used', 5, 5, 50, :link, false, 0, '{}'::jsonb, NOW(), NOW())`, { event, show, link: reverseLink ? episode : null });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at) VALUES (:b, :episode, :show, :event, 'draft', NOW(), NOW())`, { b: uuid(), episode, show, event });
    return { show, episode, event };
  }
  const episodeRow = async (f) => (await rows('SELECT evaluation_status, evaluation_json FROM episodes WHERE id = :episode', f))[0];
  const written = async (f) => ({
    ledger: (await rows('SELECT id FROM financial_transactions WHERE show_id = :show', f)).length,
    history: (await rows('SELECT id FROM character_state_history WHERE show_id = :show', f)).length,
    coins: (await rows(`SELECT coins FROM character_state WHERE show_id = :show AND character_key = 'lala'`, f))[0]?.coins,
    status: (await episodeRow(f)).evaluation_status,
    event: (await rows('SELECT status FROM world_events WHERE id = :event', f))[0].status,
  });

  beforeAll(() => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-complete', email: 'admin@complete.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-complete', email: 'editor@complete.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
  });
  beforeEach(() => {
    testNumber += 1;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    const q = (sql) => sequelize.query(sql, { replacements: { shows } }).catch(() => {});
    if (shows.length) {
      for (const t of ['financial_transactions', 'character_state_history', 'character_state', 'season_slots', 'career_goals']) await q(`DELETE FROM ${t} WHERE show_id IN (:shows)`);
      await q('DELETE FROM episode_briefs WHERE show_id IN (:shows)');
      await q('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id IN (:shows)');
      await q('DELETE FROM episodes WHERE show_id IN (:shows)');
      await q('DELETE FROM world_events WHERE show_id IN (:shows)');
      await q('DELETE FROM shows WHERE id IN (:shows)');
    }
    await sequelize.close();
  });

  describe('who may complete (asked of the API directly)', () => {
    test.each([['POST …/complete', complete], ['POST /episodes/:id/accept', accept]])('%s: signed out is 401, and nothing is written', async (_n, call) => {
      const f = await seed();
      const before = await written(f);
      const res = await call(null, f);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_REQUIRED');
      expect(await written(f)).toEqual(before);
    });

    test.each([['POST …/complete', complete], ['POST /episodes/:id/accept', accept]])('%s: a signed-in user who is not an admin is 403 AUTH_GROUP_REQUIRED, and nothing is written', async (_n, call) => {
      const f = await seed();
      const before = await written(f);
      const res = await call(editor, f);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_GROUP_REQUIRED');
      expect(await written(f)).toEqual(before);
      expect(before.status).toBeNull();
    });

    test('the group name is matched without regard to case, as every admin route does', async () => {
      const f = await seed();
      const lower = TokenService.generateTokenPair({ id: 'test-admin-lower', email: 'lower@complete.dev', name: 'Lower', groups: ['admin'], role: 'USER' }).accessToken;
      expect((await complete(lower, f)).status).toBe(200);
    });
  });

  describe('an admin completes the episode by its own id', () => {
    test('completed: the answer and the stored result are the same result, and the event is marked', async () => {
      const f = await seed();
      const res = await complete(admin, f);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const stored = await episodeRow(f);
      expect(stored.evaluation_status).toBe('accepted');
      expect(stored.evaluation_json.tier_final).toBe(res.body.data.evaluation.tier);
      expect(stored.evaluation_json.score).toBe(res.body.data.evaluation.score);
      expect(stored.evaluation_json.completed_at).toBeTruthy();
      const after = await written(f);
      expect(after.history).toBeGreaterThanOrEqual(1);
      expect(after.event).toBe('filmed');
    });

    test('the event\'s link back to the episode is missing: it completes all the same, from the brief\'s event', async () => {
      const f = await seed({ reverseLink: false });
      expect((await rows('SELECT used_in_episode_id FROM world_events WHERE id = :event', f))[0].used_in_episode_id).toBeNull();
      const res = await complete(admin, f);
      expect(res.status).toBe(200);
      expect((await episodeRow(f)).evaluation_status).toBe('accepted');
      // It was this event that was evaluated and marked, found through the brief.
      expect((await written(f)).event).toBe('filmed');
    });

    test('the legacy accept route runs the same operation for an admin', async () => {
      const f = await seed();
      const res = await accept(admin, f);
      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(true);
      expect((await episodeRow(f)).evaluation_status).toBe('accepted');
    });
  });

  describe('a repeat', () => {
    test('completing twice books nothing twice and answers "already completed" with the stored result', async () => {
      const f = await seed();
      const first = await complete(admin, f);
      expect(first.status).toBe(200);
      const after = await written(f);
      const stored = await episodeRow(f);
      const again = await complete(admin, f);
      expect(again.status).toBe(200);
      expect(again.body.data.already_completed).toBe(true);
      expect(again.body.message).toBe('Episode already completed');
      expect(again.body.data.evaluation.tier_final).toBe(stored.evaluation_json.tier_final);
      expect(await written(f)).toEqual(after);
      expect((await episodeRow(f)).evaluation_json).toEqual(stored.evaluation_json);
    });

    test('two completions at once: one books, the other finds it done; one history row, one set of ledger rows', async () => {
      const f = await seed();
      const [a, b] = await Promise.all([complete(admin, f), complete(admin, f)]);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect([a.body.data.already_completed === true, b.body.data.already_completed === true].filter(Boolean).length).toBe(1);
      // Exactly what one completion writes, measured on an identical episode completed once.
      const control = await seed();
      await complete(admin, control);
      const one = await written(control);
      const both = await written(f);
      expect(both.history).toBe(one.history);
      expect(both.ledger).toBe(one.ledger);
      expect(both.coins).toBe(one.coins);
    });

    test('the legacy accept route refuses a completed episode as it always did, and writes nothing', async () => {
      const f = await seed();
      await complete(admin, f);
      const after = await written(f);
      const res = await accept(admin, f);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already accepted/);
      expect(await written(f)).toEqual(after);
    });
  });

  describe('a refusal', () => {
    test('reopened terms: 409 EVENT_TERMS_REOPENED, nothing written', async () => {
      const f = await seed();
      await run(`UPDATE world_events SET canon_consequences = '{"terms_reopen":{"at":"2026-11-12T00:00:00Z"}}'::jsonb WHERE id = :event`, f);
      const before = await written(f);
      const res = await complete(admin, f);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EVENT_TERMS_REOPENED');
      expect(await written(f)).toEqual(before);
    });

    test.each([['POST …/complete', complete], ['POST /episodes/:id/accept', accept]])('%s: a lock another writer held is the retryable 409, not a 500', async (_n, call) => {
      const f = await seed();
      const before = await written(f);
      jest.spyOn(completion, 'completeEpisode').mockRejectedValue(Object.assign(new Error('canceling statement due to lock timeout'), { original: { code: '55P03' } }));
      const res = await call(admin, f);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ success: false, code: 'RETRY' });
      expect(res.body.error).toMatch(/try again/i);
      expect(await written(f)).toEqual(before);
    });

    test('any other failure is still a 500', async () => {
      const f = await seed();
      jest.spyOn(completion, 'completeEpisode').mockRejectedValue(new Error('something else'));
      expect((await complete(admin, f)).status).toBe(500);
    });
  });

  describe('an override recorded on an estimate', () => {
    test('it stays readable until completion, and completion does not apply it: the stored result is the one completion computes', async () => {
      const f = await seed();
      const estimate = { score: 40, tier_final: 'slay', overrides: [{ type: 'tier_change', tier_from: 'safe', tier_to: 'slay', reason_code: 'HOUSE_FAVOR' }] };
      await run(`UPDATE episodes SET evaluation_status = 'computed', evaluation_json = CAST(:j AS jsonb) WHERE id = :episode`, { ...f, j: JSON.stringify(estimate) });
      // Still there, untouched, for the page to show.
      expect((await episodeRow(f)).evaluation_json.overrides).toHaveLength(1);
      const res = await complete(admin, f);
      expect(res.status).toBe(200);
      const stored = await episodeRow(f);
      expect(stored.evaluation_status).toBe('accepted');
      expect(stored.evaluation_json.tier_final).toBe(res.body.data.evaluation.tier);
      expect(stored.evaluation_json.overrides || []).toEqual([]);
    });
  });

  test('no model is called', () => {
    expect(mockAsk.create).not.toHaveBeenCalled();
  });
});
