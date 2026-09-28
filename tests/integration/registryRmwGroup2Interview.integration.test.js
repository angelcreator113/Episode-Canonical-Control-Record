/**
 * F-Reg-2 fix group 2 (v1.2 R2), src/routes/memories/interview.js: row 50 of
 * the scoping note's §3.4 (F-Reg-2_Fix_Plan_v1.0.md §4.2). POST
 * /character-interview-save-progress read the character, spread its
 * extra_fields, set interview_progress and saved the whole object back, so a
 * key another request wrote in between was lost.
 * characterRegistry.js was #2179/#2181; registrySync.js #2183;
 * characterGenerationRoutes.js #2186/#2192; consciousness.js #2198.
 *
 * The test adds a plot thread (another extra_fields key, written atomically
 * since #2179) immediately before the save's UPDATE reaches the database: the
 * moment a stale read loses a concurrent write. On origin/main the save
 * writes back the extra_fields it read earlier and the thread is lost; with
 * the fix the save merges into the column as it is and both keys survive.
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

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('F-Reg-2 fix group 2, memories/interview.js: interleaved extra_fields writes are not lost', () => {
  let token;
  const ids = { reg: uuid(), rc: uuid() };
  const auth = () => `Bearer ${token}`;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-rmw-interview',
      email: 'test@rmw-interview.dev',
      name: 'RMW Interview Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
    await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'RMW interview registry', NOW(), NOW())`, ids);
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, extra_fields, created_at, updated_at)
               VALUES (:rc, :reg, :key, 'Interview Character', CAST(:extra AS jsonb), NOW(), NOW())`,
      { ...ids, key: `interview-${ids.rc.slice(0, 8)}`, extra: JSON.stringify({ kept_key: 'present before both writes' }) });
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await run(`DELETE FROM character_registries WHERE id = :reg`, ids); // cascades characters
  });

  it('row 50: a progress save and a concurrent plot thread keep both', async () => {
    const addThread = () => request(app)
      .post(`/api/v1/character-registry/characters/${ids.rc}/plot-threads`)
      .set('Authorization', auth())
      .send({ title: 'Thread added by the second request' });

    // Run the plot thread to completion just before the save's UPDATE of
    // registry_characters is sent.
    const originalQuery = sequelize.query.bind(sequelize);
    let secondPromise = null;
    jest.spyOn(sequelize, 'query').mockImplementation(async (sql, ...rest) => {
      const text = typeof sql === 'string' ? sql : sql?.query || '';
      if (!secondPromise && /^\s*UPDATE\s+"?registry_characters"?/i.test(text)) {
        secondPromise = addThread();
        await secondPromise;
      }
      return originalQuery(sql, ...rest);
    });

    const save = await request(app)
      .post('/api/v1/memories/character-interview-save-progress')
      .set('Authorization', auth())
      .send({ character_id: ids.rc, answers: { q1: 'saved by the first request' }, question_index: 1, step: 'interview' });
    jest.restoreAllMocks();
    const second = await secondPromise;

    expect(save.status).toBe(200);
    expect(second.status).toBe(200);
    const [row] = await q(`SELECT extra_fields FROM registry_characters WHERE id = :rc`, ids);
    expect(row.extra_fields.kept_key).toBe('present before both writes');
    expect(row.extra_fields.interview_progress).toMatchObject({ answers: { q1: 'saved by the first request' }, question_index: 1, step: 'interview' });
    expect(row.extra_fields.plot_threads).toEqual([expect.objectContaining({ title: 'Thread added by the second request' })]);
  });

  it('row 50: an unknown character still returns 404', async () => {
    const res = await request(app)
      .post('/api/v1/memories/character-interview-save-progress')
      .set('Authorization', auth())
      .send({ character_id: uuid(), step: 'interview' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Character not found' });
  });
});
