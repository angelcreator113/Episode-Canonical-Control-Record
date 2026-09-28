/**
 * F-Reg-2 fix group 2 (v1.2 R2), characterRegistry.js part 1: rows 18, 19,
 * 20, 30 and 33 of the scoping note's §3.4 (F-Reg-2_Fix_Plan_v1.0.md §4.2).
 *
 * Each test interleaves a second write between the handler's read and its
 * write, deterministically:
 *   - rows 18–20: the first request's read of the character is held until a
 *     second request has run (or, when the fix locks the row, until a short
 *     timeout shows the second is waiting on the lock);
 *   - row 30: a column is set between the registry read and the update;
 *   - row 33: a column is set during the AI call.
 * On origin/main one of the two writes is lost; with the fix both survive.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = '/api/v1/character-registry';

async function seed(extraFields = null) {
  const ids = { reg: uuid(), rc: uuid() };
  await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'RMW part 1 registry', NOW(), NOW())`, ids);
  await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, extra_fields, created_at, updated_at)
             VALUES (:rc, :reg, :key, 'RMW Character', CAST(:ef AS jsonb), NOW(), NOW())`,
    { ...ids, key: `rmw-${ids.rc.slice(0, 8)}`, ef: extraFields === null ? null : JSON.stringify(extraFields) });
  return ids;
}

async function cleanup(ids) {
  await run(`DELETE FROM character_registries WHERE id = :reg`, ids); // cascades characters
}

const threadsOf = async (ids) => {
  const [row] = await q(`SELECT extra_fields->'plot_threads' AS threads FROM registry_characters WHERE id = :rc`, ids);
  return row.threads || [];
};

// Hold the first call of Model.findByPk after it returns, until `second()`
// has finished or `waitMs` has passed, whichever is first. Returns a promise
// for the second request's response.
function interleave(Model, second, waitMs = 600) {
  const original = Model.findByPk.bind(Model);
  let secondPromise = null;
  let first = true;
  const spy = jest.spyOn(Model, 'findByPk').mockImplementation(async (...args) => {
    const result = await original(...args);
    if (first) {
      first = false;
      secondPromise = second();
      await Promise.race([secondPromise.then(() => {}, () => {}), sleep(waitMs)]);
    }
    return result;
  });
  return { spy, secondDone: () => secondPromise };
}

(shouldSkip ? describe.skip : describe)('F-Reg-2 fix group 2, characterRegistry.js part 1: interleaved writes are not lost', () => {
  let token;
  const seeded = [];
  const auth = () => `Bearer ${token}`;

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-rmw-part-1',
      email: 'test@rmw-part-1.dev',
      name: 'RMW Part 1 Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    for (const ids of seeded) await cleanup(ids);
  });

  it('row 18: two concurrent POST plot-threads both keep their thread', async () => {
    const ids = await seed({ other_key: 'kept' });
    seeded.push(ids);

    const post = (title) => request(app).post(`${BASE}/characters/${ids.rc}/plot-threads`).set('Authorization', auth()).send({ title });
    const { secondDone } = interleave(models.RegistryCharacter, () => post('second thread'));
    const first = await post('first thread');
    const second = await secondDone();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const titles = (await threadsOf(ids)).map((t) => t.title).sort();
    expect(titles).toEqual(['first thread', 'second thread']);
    const [row] = await q(`SELECT extra_fields->>'other_key' AS other FROM registry_characters WHERE id = :rc`, ids);
    expect(row.other).toBe('kept');
  });

  it('row 19: two concurrent PUT plot-threads on different threads both keep their edit', async () => {
    const ids = await seed({ plot_threads: [{ id: 'pt-a', title: 'A' }, { id: 'pt-b', title: 'B' }] });
    seeded.push(ids);

    const put = (threadId, title) =>
      request(app).put(`${BASE}/characters/${ids.rc}/plot-threads/${threadId}`).set('Authorization', auth()).send({ title });
    const { secondDone } = interleave(models.RegistryCharacter, () => put('pt-b', 'B edited'));
    const first = await put('pt-a', 'A edited');
    const second = await secondDone();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const byId = Object.fromEntries((await threadsOf(ids)).map((t) => [t.id, t.title]));
    expect(byId).toEqual({ 'pt-a': 'A edited', 'pt-b': 'B edited' });
  });

  it('row 20: two concurrent DELETE plot-threads both remove their thread', async () => {
    const ids = await seed({ plot_threads: [{ id: 'pt-a', title: 'A' }, { id: 'pt-b', title: 'B' }, { id: 'pt-c', title: 'C' }] });
    seeded.push(ids);

    const del = (threadId) => request(app).delete(`${BASE}/characters/${ids.rc}/plot-threads/${threadId}`).set('Authorization', auth());
    const { secondDone } = interleave(models.RegistryCharacter, () => del('pt-b'));
    const first = await del('pt-a');
    const second = await secondDone();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await threadsOf(ids)).map((t) => t.id)).toEqual(['pt-c']);
  });

  it('row 30: registry backfill-sections keeps a value set after its read instead of writing the default', async () => {
    const ids = await seed();
    seeded.push(ids);

    const setDuringRequest = () => run(`UPDATE registry_characters SET aesthetic_dna = CAST(:v AS jsonb) WHERE id = :rc`,
      { ...ids, v: JSON.stringify({ palette: 'set meanwhile' }) });
    interleave(models.CharacterRegistry, setDuringRequest);

    const res = await request(app).post(`${BASE}/registries/${ids.reg}/backfill-sections`).set('Authorization', auth());
    expect(res.status).toBe(200);

    const [row] = await q(`SELECT aesthetic_dna, career_status FROM registry_characters WHERE id = :rc`, ids);
    expect(row.aesthetic_dna).toEqual({ palette: 'set meanwhile' });
    expect(row.career_status).toEqual({}); // still filled where nothing was set
  });

  it('row 33: character backfill-sections keeps a value set during the AI call and fills the rest', async () => {
    const ids = await seed({ plot_threads: [{ id: 'pt-x', title: 'existing' }] });
    seeded.push(ids);

    let calls = 0;
    mockCreate.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) {
        await run(`UPDATE registry_characters SET core_desire = 'set during the call' WHERE id = :rc`, ids);
        return { content: [{ text: JSON.stringify({ core_desire: 'ai desire', core_fear: 'ai fear' }) }] };
      }
      return { content: [{ text: '[]' }] };
    });

    const res = await request(app).post(`${BASE}/characters/${ids.rc}/backfill-sections`).set('Authorization', auth());
    expect(res.status).toBe(200);

    const [row] = await q(`SELECT core_desire, core_fear FROM registry_characters WHERE id = :rc`, ids);
    expect(row).toEqual({ core_desire: 'set during the call', core_fear: 'ai fear' });
    expect(res.body.filled).toEqual(expect.arrayContaining(['core_fear']));
    expect(res.body.filled).not.toContain('core_desire');
  });
});
